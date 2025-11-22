# Portfolio Price Display Debugging

## Issue
Portfolio shows "—" for Market / Instant Sell columns despite StockX data pipeline working

## Investigation Summary

### ✅ CONFIRMED WORKING
1. **Database has price data**
   - `stockx_market_latest` contains 297 rows
   - User has 4 mapped items in `inventory_market_links`
   - Example data: `lowest_ask: 60, highest_bid: 36` for GBP

2. **RLS is NOT blocking access**
   - Test query with ANON_KEY successfully fetched 297 rows
   - No RLS policies blocking `stockx_market_latest` access

3. **Data pipeline is working**
   - `/api/stockx/sync/prices` completes successfully
   - `stockx_market_snapshots` has ~300 rows
   - Worker creates correct (product_id, variant_id, currency_code) combinations

### 🔍 NEXT STEPS
1. **Check browser console** for debug logs added to `useInventoryV3.ts`:
   - Line 112-116: StockX prices fetch count
   - Line 203-208: Price lookup for each item

2. **Verify key format** matches between:
   - Hook building: `${stockx_product_id}:${stockx_variant_id}:${currency_code}`
   - Diagnostic script: same format

3. **Possible causes**:
   - Hook might be fetching data but lookup keys don't match
   - Currency filtering might be excluding rows
   - Inventory items might not have StockX mappings

## Debug Logs Added

### `src/hooks/useInventoryV3.ts:112-116`
```javascript
console.log('[useInventoryV3] StockX prices fetched:', {
  count: stockxPrices?.length || 0,
  error: stockxPricesError,
  sample: stockxPrices?.[0]
})
```

### `src/hooks/useInventoryV3.ts:203-208`
```javascript
console.log('[useInventoryV3] Price lookup for', item.sku, {
  priceKey: priceKeyUser,
  found: !!stockxPrice,
  mapSize: stockxPriceMap.size,
  mapKeys: Array.from(stockxPriceMap.keys()).slice(0, 3)
})
```

## Test Results

### Diagnostic Script (`scripts/check-market-join.mjs`)
```
✅ Found 19 inventory items for user
✅ Found 4 inventory_market_links
✅ Found price data in stockx_market_latest for GBP:
   - lowest_ask: 60
   - highest_bid: 36
   - last_sale_price: null
```

### Client Query Test (`scripts/test-client-query.mjs`)
```
✅ Successfully fetched 297 rows from stockx_market_latest
Sample:
  - stockx_product_id: 44d8eef8-bf82-4e3c-8056-25608e54364e
  - stockx_variant_id: 010330d5-39be-4db4-9554-c18d68b3f89f
  - currency_code: EUR
  - lowest_ask: 248
  - highest_bid: 94
```

## Action Required
Check Portfolio page browser console for the debug logs to see what the hook is actually fetching and why lookups might be failing.
