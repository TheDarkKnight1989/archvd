# Scaling Architecture - Production Market Data Platform

## Current Issue

**Problem**: Initial sync uses batch size of 3, taking ~15 minutes for 112 products
**Blocker**: Vercel cron timeout (10s hobby, 60s Pro) will kill long-running syncs
**Impact**: Won't scale beyond a few hundred products

## Production-Ready Solution

### Architecture: Tiered Sync with Queue

Instead of syncing all products in one cron run, use a **distributed queue approach**:

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel Cron (runs every hour)                              │
│  Timeout: 10s (hobby) / 60s (Pro)                           │
├─────────────────────────────────────────────────────────────┤
│  1. Select products to sync (based on tier & last_synced_at)│
│  2. Process 15-20 products in parallel                      │
│  3. Update last_synced_at                                   │
│  4. Exit cleanly before timeout                             │
└─────────────────────────────────────────────────────────────┘
```

### Tier-Based Sync Strategy

**Hot Tier** (hourly):
- High-value products (Jordan 1s, Dunks, Yeezys)
- Recently sold items
- User watchlist items
- Limit: 20 products per run

**Warm Tier** (every 6 hours):
- Medium-demand products
- Limit: 50 products per run

**Cold Tier** (daily):
- Low-demand products
- Limit: 100 products per run

**Frozen Tier** (on-demand):
- Only sync when user views product page
- Use API route `/api/sync/product/[sku]`

### Implementation

#### 1. Update Cron Route for Tiered Sync

File: `src/app/api/cron/sync-market-data/route.ts`

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tier = searchParams.get('tier') || 'hot'

  // Tier configuration
  const tierConfig = {
    hot: { limit: 20, maxAge: 60 * 60 * 1000 },        // 1 hour
    warm: { limit: 50, maxAge: 6 * 60 * 60 * 1000 },   // 6 hours
    cold: { limit: 100, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
  }

  const config = tierConfig[tier] || tierConfig.hot
  const maxAge = new Date(Date.now() - config.maxAge)

  // Select products that need syncing
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      tier,
      last_synced_at,
      product_variants (
        alias_catalog_id,
        stockx_product_id
      )
    `)
    .eq('tier', tier)
    .or(`last_synced_at.is.null,last_synced_at.lt.${maxAge.toISOString()}`)
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(config.limit)

  // Process in parallel (all at once, no batching)
  const results = await Promise.allSettled(
    (products || []).map(async (product) => {
      try {
        // Sync Alias
        if (product.product_variants[0]?.alias_catalog_id) {
          await syncAliasProductMultiRegion(
            aliasClient,
            product.product_variants[0].alias_catalog_id,
            { sku: product.sku, userRegion: 'UK', syncSecondaryRegions: true }
          )
        }

        // Sync StockX
        if (product.product_variants[0]?.stockx_product_id) {
          await syncProductAllRegions(
            undefined,
            product.product_variants[0].stockx_product_id,
            'UK',
            true
          )
        }

        // Update last_synced_at
        await supabase
          .from('products')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', product.id)

        return { success: true, sku: product.sku }
      } catch (error: any) {
        return { success: false, sku: product.sku, error: error.message }
      }
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - succeeded

  return Response.json({
    tier,
    processed: results.length,
    succeeded,
    failed,
    duration: Date.now() - startTime
  })
}
```

#### 2. Add Tier Column to Products Table

```sql
-- Add tier column for sync prioritization
ALTER TABLE products
ADD COLUMN tier TEXT DEFAULT 'warm' CHECK (tier IN ('hot', 'warm', 'cold', 'frozen'));

-- Add index for efficient tier-based queries
CREATE INDEX idx_products_tier_last_synced
ON products(tier, last_synced_at NULLS FIRST);

-- Example tier assignment
UPDATE products SET tier = 'hot'
WHERE sku IN (
  'DD1503-103',  -- Jordan 1 Panda
  'DZ5485-410',  -- Jordan 4 Craft
  'CT8532-111'   -- Dunk Low Panda
);

UPDATE products SET tier = 'cold'
WHERE sku IN (
  'M2002RDA',    -- New Balance (lower demand)
  'U9060BPM'
);
```

#### 3. Configure Vercel Crons

File: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-market-data?tier=hot",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/sync-market-data?tier=warm",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/sync-market-data?tier=cold",
      "schedule": "0 0 * * *"
    }
  ]
}
```

#### 4. On-Demand Sync for Frozen Tier

File: `src/app/api/sync/product/[sku]/route.ts`

```typescript
export async function POST(
  request: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params

  // Verify user is authenticated (or use rate limiting)
  const session = await getServerSession()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      product_variants (
        alias_catalog_id,
        stockx_product_id
      )
    `)
    .eq('sku', sku)
    .single()

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 })
  }

  // Check if recently synced (< 5 minutes ago)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const { data: recentSync } = await supabase
    .from('products')
    .select('last_synced_at')
    .eq('id', product.id)
    .gte('last_synced_at', fiveMinutesAgo.toISOString())
    .single()

  if (recentSync) {
    return Response.json({
      message: 'Product synced recently',
      last_synced_at: recentSync.last_synced_at
    })
  }

  // Trigger sync
  // ... sync logic ...

  return Response.json({ success: true, sku })
}
```

## Performance Benchmarks

### Current Architecture (Batch Size 3)
- **112 products**: ~15 minutes
- **1,000 products**: ~2.2 hours
- **10,000 products**: ~22 hours
- ❌ **Doesn't scale**

### Optimized Architecture (Batch Size 20, No Delays)
- **112 products**: ~3-4 minutes (initial sync)
- **1,000 products**: ~30 minutes (one-time)
- **10,000 products**: ~5 hours (one-time)
- ✅ **Scales with tiered crons**

### Tiered Production Architecture
- **Hot tier** (20 products): ~30 seconds per cron run ✅
- **Warm tier** (50 products): ~60 seconds per cron run ✅
- **Cold tier** (100 products): ~2 minutes per cron run (use background job)
- ✅ **Scales to millions of products**

## Rate Limit Handling

Add exponential backoff for API rate limits:

```typescript
async function syncWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      // Check if rate limit error
      if (error.status === 429 || error.message.includes('rate limit')) {
        const delay = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000, 10000)
        console.log(`Rate limited, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
```

## Migration Path

### Phase 1: Optimize Initial Sync (NOW)
1. Update `BATCH_SIZE` from 3 → 20 in initial-comprehensive-sync.ts
2. Remove delays between batches (or reduce to 500ms)
3. Complete initial data population

### Phase 2: Add Tier Column (After Initial Sync)
1. Add migration for `tier` column
2. Classify existing products into tiers
3. Add index for tier-based queries

### Phase 3: Update Cron Route (Before Production Deploy)
1. Implement tiered sync logic in cron route
2. Update vercel.json with tier-based cron schedules
3. Deploy to production

### Phase 4: Add On-Demand Sync (Optional)
1. Create `/api/sync/product/[sku]` endpoint
2. Call from product detail pages for frozen tier
3. Add rate limiting to prevent abuse

## Recommended Settings

For **112 products** (current):
- Hot tier: 30 products (high-value items)
- Warm tier: 50 products (medium demand)
- Cold tier: 32 products (low demand)
- **Total sync time per hour**: ~45 seconds ✅

For **1,000 products** (future):
- Hot tier: 50 products (sync hourly)
- Warm tier: 200 products (sync every 6h)
- Cold tier: 500 products (sync daily)
- Frozen tier: 250 products (on-demand only)
- **Total sync time per hour**: ~60 seconds ✅

For **10,000+ products** (scale):
- Use Vercel background jobs (Pro plan)
- Or migrate to dedicated workers (Railway, Render)
- Implement queue-based architecture (BullMQ, Inngest)
