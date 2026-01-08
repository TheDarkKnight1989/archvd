# Alias Recent Sales - Wired Into Refresh Pipeline ✅

**Date:** 2025-12-03
**Status:** Integration Complete - Ready for Testing

---

## 🎯 What Was Wired

Integrated Alias `recent_sales` endpoint into the master market data refresh pipeline with minimal changes.

### Changes Made

1. **New Sync Function** - [src/lib/services/alias/sync.ts:471-644](src/lib/services/alias/sync.ts#L471-L644)
   - Added `syncAliasToMasterMarketData()` function
   - Calls **both** availabilities + recent_sales in parallel
   - Uses ingestion mappers to populate `master_market_data`

2. **Feature Flag** - `ALIAS_RECENT_SALES_ENABLED`
   - Environment variable to control recent_sales calls
   - If `false`: only availabilities are synced (volume fields remain NULL)
   - If `true`: both availabilities + recent_sales are synced

3. **Type Updates** - [src/lib/services/alias/types.ts](src/lib/services/alias/types.ts)
   - Added `size_unit?: string` to `AliasPricingVariant`
   - Added `number_of_listings`, `number_of_offers` to `AliasAvailability`
   - Made `availability` nullable in `AliasPricingVariant`

4. **Test Script** - [scripts/test-alias-recent-sales-integration.mjs](scripts/test-alias-recent-sales-integration.mjs)
   - Tests the complete flow end-to-end
   - Validates volume metrics are populated

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ syncAliasToMasterMarketData()                                │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                  │
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ listPricingInsights()│          │  getRecentSales()   │
│ (availabilities)     │          │  (volume metrics)   │
└──────────┬───────────┘          └──────────┬──────────┘
           │                                  │
           │  (both run in parallel)          │
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ withAliasSnapshot   │          │ withAliasSnapshot   │
│ → alias_raw_snapshots│          │ → alias_raw_snapshots│
└──────────┬───────────┘          └──────────┬──────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│ingestAliasAvailabilities()     │ingestAliasRecentSales()
│ → master_market_data│          │ → UPDATE volume fields│
│   (INSERT rows)     │          │   in existing rows     │
└─────────────────────┘          └─────────────────────┘
```

---

## 📝 Function Signature

```typescript
export async function syncAliasToMasterMarketData(
  client: AliasClient,
  catalogId: string,
  options: {
    sku?: string;
    regionId?: string;
    includeConsigned?: boolean;
  } = {}
): Promise<MasterMarketDataSyncResult>
```

**Returns:**
```typescript
{
  success: boolean;
  catalogId: string;
  sku?: string;
  variantsIngested: number;      // Number of availability rows inserted
  volumeMetricsUpdated: number;  // Number of sizes with volume data updated
  error?: string;
}
```

---

## 🚀 Usage Examples

### Example 1: Basic Sync

```typescript
import { createAliasClient } from '@/lib/services/alias';
import { syncAliasToMasterMarketData } from '@/lib/services/alias/sync';

const client = createAliasClient();

const result = await syncAliasToMasterMarketData(client, 'CATALOG_ID_HERE', {
  sku: 'DD1391-100',
});

console.log('Synced:', result.variantsIngested, 'variants');
console.log('Updated volume for:', result.volumeMetricsUpdated, 'sizes');
```

### Example 2: From API Route

```typescript
// src/app/api/alias/refresh/[catalogId]/route.ts
import { createAliasClient } from '@/lib/services/alias';
import { syncAliasToMasterMarketData } from '@/lib/services/alias/sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> }
) {
  const { catalogId } = await params;
  const client = createAliasClient();

  const result = await syncAliasToMasterMarketData(client, catalogId, {
    sku: request.nextUrl.searchParams.get('sku') || undefined,
  });

  return NextResponse.json(result);
}
```

### Example 3: Bulk Sync Script

```javascript
// scripts/sync-all-alias-products.mjs
import { createAliasClient } from '../src/lib/services/alias/index.js';
import { syncAliasToMasterMarketData } from '../src/lib/services/alias/sync.js';
import { createClient } from '@supabase/supabase-js';

const client = createAliasClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all unique catalog IDs from inventory
const { data: links } = await supabase
  .from('inventory_alias_links')
  .select('alias_catalog_id, Inventory!inner(sku)')
  .not('alias_catalog_id', 'is', null);

const uniqueCatalogIds = [...new Set(links.map(l => l.alias_catalog_id))];

console.log(`Syncing ${uniqueCatalogIds.length} Alias products...`);

for (const catalogId of uniqueCatalogIds) {
  const link = links.find(l => l.alias_catalog_id === catalogId);
  const sku = link?.Inventory?.sku;

  const result = await syncAliasToMasterMarketData(client, catalogId, { sku });

  console.log(`✅ ${catalogId}: ${result.variantsIngested} variants, ${result.volumeMetricsUpdated} volume updates`);

  // Rate limit
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

---

## ⚙️ Feature Flag Configuration

### Enable Recent Sales (Production)

```bash
# .env.production
ALIAS_RECENT_SALES_ENABLED=true
```

### Disable Recent Sales (Testing)

```bash
# .env.local
ALIAS_RECENT_SALES_ENABLED=false
```

### Behavior by Flag State

| Flag Value | Behavior |
|------------|----------|
| `true` | ✅ Calls both availabilities + recent_sales |
| `false` | ⚠️ Calls availabilities only (volume fields = NULL) |
| (unset) | ⚠️ Same as `false` |

**Log Output When Enabled:**
```
[Alias Master Sync] Fetching recent sales (feature flag enabled)...
[Alias Master Sync] Found 87 recent sales
[AliasRecentSales] ✅ Updated volume metrics for catalog_id=abc123 (sizes=12)
```

**Log Output When Disabled:**
```
[Alias Master Sync] Recent sales DISABLED (ALIAS_RECENT_SALES_ENABLED=false)
```

---

## 🧪 Testing

### Step 1: Enable Feature Flag

```bash
export ALIAS_RECENT_SALES_ENABLED=true
```

### Step 2: Set Test Catalog ID

```bash
# Find an Alias catalog ID for a popular product (e.g., Jordan 1 Low Panda)
export TEST_ALIAS_CATALOG_ID="your-catalog-id-here"
```

### Step 3: Run Test Script

```bash
node scripts/test-alias-recent-sales-integration.mjs
```

**Expected Output:**
```
🧪 Testing Alias Recent Sales Integration
==========================================

Feature flag ALIAS_RECENT_SALES_ENABLED: true

📦 Testing: Jordan 1 Low Panda
   Catalog ID: abc123xyz
   SKU: DD1391-100
   ────────────────────────────────────────────────────────────

[1] Syncing to master_market_data...
[Alias Master Sync] Starting sync for catalog: abc123xyz
[Alias Master Sync] Fetching availabilities...
[Alias Master Sync] Found 15 availability variants
[Alias Master Sync] ✅ Ingested 15 availability variants
[Alias Master Sync] Fetching recent sales (feature flag enabled)...
[Alias Master Sync] Found 87 recent sales
[AliasRecentSales] ✅ Updated volume metrics for catalog_id=abc123xyz (sizes=12)

Sync result: {
  success: true,
  variantsIngested: 15,
  volumeMetricsUpdated: 12
}

[2] Querying master_market_data...

Found 15 rows in master_market_data:

   Size 8 (consigned: false):
      Lowest Ask: $142.00
      Highest Bid: $130.00
      Sales 72h: 3
      Sales 30d: 28
      Last Sale: $138.00
      Snapshot: 12/3/2025, 10:30:00 AM

[3] Validating volume metrics...

   ✅ All volume metrics populated!

✅ Test completed successfully
```

### Step 4: Run Validation Script

```bash
npx tsx scripts/validate-master-market-data.ts
```

**Expected Output:**
```
📦 Testing: Jordan 1 Low Panda (DD1391-100)
   SKU: DD1391-100, Size: 10.5
   ────────────────────────────────────────────────────────────
   ✅ PASSED

   Price Data:
      STOCKX: $145.00
         Snapshot: 12/3/2025, 10:28:00 AM
         Freshness: fresh
      ALIAS: $142.00
         Snapshot: 12/3/2025, 10:30:00 AM
         Freshness: fresh

📊 Validation Summary
=====================
Total tests: 4
Passed: 4 ✅
Failed: 0 ❌
Success rate: 100.0%

✨ All tests passed!
```

---

## 📊 Database Verification

### Query 1: Check Alias Volume Data

```sql
SELECT
  sku,
  size_key,
  is_consigned,
  lowest_ask,
  highest_bid,
  sales_last_72h,
  sales_last_30d,
  last_sale_price,
  snapshot_at
FROM master_market_data
WHERE provider = 'alias'
  AND sku = 'DD1391-100'
  AND size_key = '10.5'
ORDER BY is_consigned, snapshot_at DESC;
```

**Expected Result (when ALIAS_RECENT_SALES_ENABLED=true):**
| sku | size_key | is_consigned | lowest_ask | sales_72h | sales_30d | last_sale |
|------------|----------|--------------|------------|-----------|-----------|-----------|
| DD1391-100 | 10.5 | false | 142.00 | **3** | **28** | **138.00** |
| DD1391-100 | 10.5 | true | 138.00 | **1** | **15** | **135.00** |

### Query 2: Compare StockX vs Alias Volume Data

```sql
SELECT
  provider,
  sku,
  size_key,
  sales_last_72h,
  sales_last_30d,
  last_sale_price
FROM master_market_data
WHERE sku = 'DD1391-100'
  AND size_key = '10.5'
  AND is_consigned = FALSE
ORDER BY provider;
```

**Expected Result:**
| provider | sales_72h | sales_30d | last_sale |
|----------|-----------|-----------|-----------|
| alias | **5** | **42** | **138.00** |
| stockx | 12 | 98 | 142.00 |

---

## 🐛 Troubleshooting

### Issue: Volume fields still NULL after sync

**Possible causes:**
1. Feature flag not set: `ALIAS_RECENT_SALES_ENABLED !== 'true'`
2. Recent sales endpoint returned empty array
3. Ingestion mapper failed silently

**Debug steps:**
```bash
# 1. Check feature flag
echo $ALIAS_RECENT_SALES_ENABLED  # Should print: true

# 2. Check raw snapshots
psql $DATABASE_URL -c "
  SELECT endpoint, catalog_id, created_at,
         jsonb_array_length(response->'recent_sales') as sales_count
  FROM alias_raw_snapshots
  WHERE endpoint = 'recent_sales'
  ORDER BY created_at DESC
  LIMIT 5;
"

# 3. Check logs for errors
grep "AliasRecentSales\|Alias Master Sync" logs/app.log
```

### Issue: Type errors when importing

**Cause:** Old TypeScript cache

**Fix:**
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Issue: Parallel requests timing out

**Cause:** Alias API rate limits

**Fix:** Add delay between syncs:
```javascript
// In bulk sync script
for (const catalogId of catalogIds) {
  await syncAliasToMasterMarketData(client, catalogId, { sku });
  await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
}
```

---

## 📈 Performance Considerations

### API Calls per Sync

Each `syncAliasToMasterMarketData()` call makes:
- 1x `listPricingInsights()` (availabilities)
- 1x `getRecentSales()` (if feature flag enabled)
- **Total: 2 API calls** (run in parallel)

### Database Operations per Sync

- **INSERT**: ~10-20 rows per product (availabilities → master_market_data)
- **UPDATE**: ~10-20 rows per product (recent_sales → volume fields)
- **Total: ~20-40 operations** (uses indexes, fast)

### Recommended Batch Sizes

- **Single product**: Instant (<500ms)
- **Bulk sync (100 products)**: ~60 seconds with 500ms delays
- **Full inventory (1000 products)**: ~10 minutes with 500ms delays

---

## ✅ Integration Checklist

- ✅ New sync function added to `alias/sync.ts`
- ✅ Feature flag `ALIAS_RECENT_SALES_ENABLED` implemented
- ✅ Type definitions updated for compatibility
- ✅ Test script created
- ✅ Both ingestion mappers called correctly
- ✅ Raw snapshots logged for both endpoints
- ✅ Volume metrics update existing rows (not insert)
- ✅ Non-fatal error handling for recent_sales
- ✅ Clear logging with `[AliasRecentSales]` prefix
- ⏳ **TODO:** Enable in production after testing
- ⏳ **TODO:** Create cron job or API route to auto-sync
- ⏳ **TODO:** Add to bulk sync script

---

## 🔮 Next Steps

### 1. Enable Feature Flag in Production

```bash
# Vercel
vercel env add ALIAS_RECENT_SALES_ENABLED production
# Value: true

# Or .env.production
echo "ALIAS_RECENT_SALES_ENABLED=true" >> .env.production
```

### 2. Create Refresh API Route

```typescript
// src/app/api/cron/alias/refresh/route.ts
import { createAliasClient } from '@/lib/services/alias';
import { syncAliasToMasterMarketData } from '@/lib/services/alias/sync';

export async function POST(request: NextRequest) {
  // Get all catalog IDs from inventory
  // Sync each one
  // Return summary
}
```

### 3. Add to Bulk Sync Script

Update `scripts/sync-all-market-data.mjs` to use `syncAliasToMasterMarketData()` instead of old sync functions.

### 4. Monitor in Production

- Check logs for `[AliasRecentSales]` messages
- Verify volume metrics are populated
- Monitor API rate limits

---

**Status:** ✅ Integration Complete - Ready for Testing
**Next:** Enable feature flag → Test with real data → Deploy to production
