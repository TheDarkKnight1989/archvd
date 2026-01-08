# Roadmap to Production - Market Data Platform

## Current Status ✅

### Data Foundation
- ✅ Products table with 112 SKUs
- ✅ 3,360 product variants (30 sizes per SKU)
- ✅ **100% dual mapping**: All 112 products mapped to BOTH Alias AND StockX
- ✅ Master market data table with 45+ comprehensive fields
- ✅ Multi-region support (US, UK, EU, global)
- ✅ Comprehensive sync functions already built:
  - `syncAliasProductMultiRegion` - pulls ALL Alias data
  - `syncProductAllRegions` - pulls ALL StockX data

### What We've Fixed
- ✅ SQL migration for production schema
- ✅ Fixed StockX search API (was sending "[object Object]")
- ✅ Validated product mapping (exact match only)
- ✅ All products now have UNIQUE StockX IDs

## Remaining Work 🚧

### 1. Initial Comprehensive Sync (NEXT STEP)
**Status**: Ready to run
**Why**: Need to populate master_market_data with correct StockX IDs
**Script**: `scripts/initial-comprehensive-sync.ts` (already exists)
**What it does**:
- Syncs ALL Alias data: multi-region pricing, histograms, recent sales, volume metrics
- Syncs ALL StockX data: multi-currency pricing, flex pricing, pricing suggestions, consigned
- Processes 112 products in batches of 3 (to respect rate limits)
- Expected time: ~10-15 minutes
- **Target**: 100% success rate (was 50%, now should be 100% with correct mappings)

**Run**:
```bash
npx tsx scripts/initial-comprehensive-sync.ts 2>&1 | tee /tmp/initial-sync-final.log
```

### 2. Verify 100% Success Rate
**After sync completes**, verify:
```bash
# Check total records ingested
npx tsx scripts/master-market-health-check.ts

# Should show:
# - master_market_data: ~30,000+ records
# - Alias records: ~15,000+
# - StockX records: ~15,000+
# - Coverage: 112/112 products (100%)
```

### 3. Deploy to Vercel Production
**Why**: Crons only run in production, not locally

**Steps**:
```bash
# 1. Commit changes
git add .
git commit -m "feat: complete market data platform with dual mapping

- Fixed StockX search API bug
- Validated product mappings (100% exact matches)
- All 112 products mapped to both Alias + StockX
- Ready for production deployment"

# 2. Push to main
git push origin main

# 3. Deploy to Vercel
npx vercel --prod

# Or if using Vercel GitHub integration, it will auto-deploy
```

### 4. Configure Vercel Cron Jobs
**File**: [vercel.json](vercel.json) (already exists)

**Current schedule** (verify and adjust if needed):
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-market-data",
      "schedule": "0 */1 * * *"  // Every hour
    }
  ]
}
```

**Recommended tiered schedule** for production:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-market-data?tier=hot",
      "schedule": "0 */1 * * *"  // Hot items: Every hour
    },
    {
      "path": "/api/cron/sync-market-data?tier=warm",
      "schedule": "0 */6 * * *"  // Warm items: Every 6 hours
    },
    {
      "path": "/api/cron/sync-market-data?tier=cold",
      "schedule": "0 0 * * *"    // Cold items: Daily at midnight
    }
  ]
}
```

### 5. Verify Crons are Running in Production
**After deployment**:
```bash
# Check Vercel cron logs
vercel logs --follow

# Or in Vercel dashboard:
# Project → Settings → Cron Jobs → View execution logs
```

**What to look for**:
- Cron executes every hour
- Success rate: 100% (no skipped products)
- Response time: < 30 seconds (within Vercel's hobby plan limits)

### 6. Add Monitoring & Alerts (Optional)
**Best practice additions**:

1. **Data freshness check**:
   - Add query to dashboard showing last sync time per product
   - Alert if any product hasn't synced in 2 hours

2. **Sync health endpoint**:
   ```typescript
   // /api/health/market-data
   export async function GET() {
     const { data: products } = await supabase
       .from('products')
       .select('sku, last_synced_at')
       .order('last_synced_at', { ascending: true })
       .limit(10)

     const oldestSync = products?.[0]
     const staleDuration = Date.now() - new Date(oldestSync.last_synced_at).getTime()

     return Response.json({
       status: staleDuration > 2 * 60 * 60 * 1000 ? 'warning' : 'healthy',
       oldestProduct: oldestSync,
       staleDurationHours: staleDuration / (1000 * 60 * 60)
     })
   }
   ```

3. **Vercel monitoring integration**:
   - Enable Vercel Analytics
   - Set up Vercel Monitoring for cron execution
   - Configure alerts for failed cron runs

## Data Flow Architecture (Already Built)

### Cron Route: `/api/cron/sync-market-data/route.ts`
**What it does**:
1. Fetches products based on tier (hot/warm/cold)
2. For each product:
   - Syncs Alias data using `syncAliasProductMultiRegion`
   - Syncs StockX data using `syncProductAllRegions`
3. Updates `last_synced_at` timestamp

### Alias Sync: `syncAliasProductMultiRegion`
**Pulls**:
- Multi-region pricing (US, UK, EU, global)
- Offer histograms (price distribution)
- Recent sales (last 100 transactions)
- Volume metrics (asks/bids count)
- Consigned vs. FLEX pricing

**Inserts into**: `master_market_data` table

### StockX Sync: `syncProductAllRegions`
**Pulls**:
- Multi-currency pricing (USD, GBP, EUR)
- Standard marketplace pricing
- FLEX pricing (if available)
- Pricing suggestions (Sell Faster, Earn More, Beat US)
- Consignment pricing (if available)

**Inserts into**: `master_market_data` table

## Success Metrics

### Phase 1: Initial Sync ✅ (CURRENT)
- [x] 112 products with dual mapping
- [ ] 100% sync success rate (run initial-comprehensive-sync.ts)
- [ ] 30,000+ master_market_data records

### Phase 2: Production Deployment
- [ ] Deployed to Vercel production
- [ ] Cron jobs configured and running
- [ ] First successful hourly sync

### Phase 3: Operational
- [ ] 7 days of continuous syncing
- [ ] Zero failed syncs
- [ ] Data freshness < 2 hours for all products
- [ ] API response times < 500ms

## Timeline Estimate

1. **Initial sync**: ~15 minutes (run now)
2. **Verification**: ~5 minutes
3. **Deploy to Vercel**: ~10 minutes (commit + push)
4. **Cron configuration**: ~5 minutes
5. **Monitoring setup**: ~1 hour (optional)

**Total**: ~35 minutes to fully operational (excluding monitoring)

## Next Immediate Step

Run the initial comprehensive sync:
```bash
npx tsx scripts/initial-comprehensive-sync.ts 2>&1 | tee /tmp/initial-sync-final.log
```

This will:
- Populate master_market_data with ALL data from BOTH platforms
- Achieve the 100% success rate required
- Make the platform ready for production deployment
