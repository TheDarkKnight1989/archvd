# Phase 3.5 Fix - Test Instructions

## ✅ What Was Fixed

**Problem**: `syncSingleInventoryItemFromStockx` was writing market data to `stockx_market_prices` table, but the Portfolio UI reads from `stockx_market_latest` view which is built from `stockx_market_snapshots` table.

**Solution**:
- Created `upsertMarketSnapshot()` helper in `src/lib/market/upsert.ts:114-186`
- Updated worker to write to `stockx_market_snapshots` instead of `stockx_market_prices`
- Added automatic materialized view refresh after successful snapshot creation

**Data Flow After Fix**:
```
StockX API → upsertMarketSnapshot()
           → stockx_market_snapshots table
           → refreshStockxMarketLatestView()
           → stockx_market_latest view
           → Portfolio UI
```

## 🧪 How to Test

### Step 1: Check Baseline (No Snapshots Currently)

Run this to confirm items have NO market data yet:
```bash
node scripts/check-specific-items.mjs
```

You should see "❌ NO SNAPSHOTS found" for all 3 items.

### Step 2: Test the Fix from Browser Console

1. Open your app in browser: `http://localhost:3000`
2. Login to your account
3. Open browser DevTools console (F12)
4. Run this command to sync a test item:

```javascript
fetch('/api/stockx/sync/item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inventoryItemId: '729d9d3d-b9e2-4f1e-8286-e235624b2923'
  })
}).then(r => r.json()).then(console.log)
```

### Step 3: Check Debug Output

You should see output like:
```json
{
  "itemId": "729d9d3d-b9e2-4f1e-8286-e235624b2923",
  "stockx": {
    "productId": "...",
    "variantId": "..."
  },
  "market": {
    "currenciesProcessed": ["GBP"],
    "snapshotsCreated": 1
  },
  "debug": {
    "snapshotTableUsed": "stockx_market_snapshots",  // ✅ CORRECT TABLE
    "snapshotCreationSuccess": true,                  // ✅ SUCCESS
    "v2ApiSuccess": true,
    "mappedVariantFound": true
  }
}
```

**Key indicators of success**:
- `debug.snapshotTableUsed`: "stockx_market_snapshots" (not "stockx_market_prices")
- `debug.snapshotCreationSuccess`: true
- `market.snapshotsCreated`: 1

### Step 4: Verify Data in Database

Run the check script again:
```bash
node scripts/check-specific-items.mjs
```

Now you should see:
```
✅ Found 1 snapshots:
   GBP: Ask 250, Bid 200 (2025-...)
✅ Found in stockx_market_latest view (1 currencies):
   GBP: Ask 250, Bid 200
```

### Step 5: Check Portfolio UI

1. Navigate to Portfolio page
2. Find the item you just synced
3. Verify market price is now visible in the table

## 📊 Test Items Available

These inventory IDs are instrumented for debug tracking:
- `729d9d3d-b9e2-4f1e-8286-e235624b2923` - Jordan 1 Retro High OG University Blue
- `85a1fbbd-b271-4961-b65b-4d862ec2ac23` - Jordan 1 Retro High OG University Blue (duplicate)
- `3c386636-f732-401e-9d78-201f36a217f2` - Nike Mars Yard Shoe 1.0
- `b732c556-687e-431f-9173-e9bfe0f02c8b` - Yeezy Boost 350 V2 Bone
- `bb656212-4ee2-4e74-961a-94a33d56aeda` - New Balance 2002R Protection Pack Rain Cloud

## ❌ What to Check If It Fails

If `debug.snapshotCreationSuccess` is `false`, check:

1. **Missing Product/Variant UUIDs**:
   ```sql
   -- Check if product exists in stockx_products
   SELECT id FROM stockx_products
   WHERE stockx_product_id = 'THE_PRODUCT_ID_FROM_DEBUG';

   -- Check if variant exists in stockx_variants
   SELECT id FROM stockx_variants
   WHERE stockx_variant_id = 'THE_VARIANT_ID_FROM_DEBUG';
   ```

2. **API Error**: Check `debug.v2ApiError` for StockX API issues

3. **Variant Not Found**: Check `debug.skipReason` - variant may be delisted on StockX

## 🔧 Files Modified

1. [src/lib/market/upsert.ts:114-186](../src/lib/market/upsert.ts#L114-L186) - New `upsertMarketSnapshot()` function
2. [src/lib/providers/stockx-worker.ts:473-560](../src/lib/providers/stockx-worker.ts#L473-L560) - Updated snapshot creation code

## ⏭️ Next Steps

After confirming the fix works:
1. Consider applying same fix to `processStockXBatch` (line 206) for batch job processor
2. Create migration helper to backfill existing `stockx_market_prices` data to `stockx_market_snapshots`
3. Remove old `stockx_market_prices` table once data is migrated
