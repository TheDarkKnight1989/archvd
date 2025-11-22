# StockX Market Data API Fix

## Problem
The "List on StockX" modal was not showing bid/ask prices because:
1. SKUs were being passed directly to the market-data endpoint as product IDs
2. StockX API expects internal product IDs (UUIDs), not SKUs
3. This resulted in 404 errors: "Could not decode market data"

## Solution Implemented

### 1. SKU Detection and Search-First Approach
Added logic to detect when a SKU (style code like "IO3372-700") is passed instead of a product ID:

```typescript
// Detect if productId is a SKU using regex pattern
const isSku = /^[A-Z0-9]{2,}-[A-Z0-9]{3,}$/i.test(productId)
```

### 2. Two-Step API Process
When a SKU is detected:
1. **Search StockX API** to find the product by SKU
2. **Extract the real product ID** from search results
3. **Fetch market data** using the real product ID

### 3. Field Matching Fix
Updated the matching logic to use the correct field from StockX API responses:

```typescript
// StockX API uses 'styleId' field for SKUs, not 'sku'
const match = products.find((p: any) =>
  p.styleId === productId ||  // Primary field
  p.styleID === productId ||
  p.style_id === productId ||
  p.sku === productId
)
```

## Files Modified

### `/src/app/api/stockx/products/[productId]/market-data/route.ts`
- Lines 38-96: Added SKU detection and search logic
- Lines 67-73: Updated field matching to check `styleId` first

## Known Issues & Limitations

### 1. SKU Data Quality Issues
Some SKUs in the inventory don't exist on StockX or are typos:

**Example:**
- Database has: `DC7350-100`
- StockX returns: `DC0350-100` (note: DC**0**350 vs DC**7**350)
- Result: No exact match → empty prices

### 2. Products Not on StockX
Some inventory items may have SKUs that don't exist on StockX at all, which will result in:
- Search returns no results or different products
- Prices show as empty (dashes)

## Recommendations

### Short Term
1. **Test the modal** with products that have valid StockX SKUs
2. **Document which SKUs work** and which don't
3. **Consider fallback** to cached price data from `stockx_market_prices` table when live API fails

### Long Term
1. **SKU Validation**: Add a validation step when items are added to inventory
2. **Product Matching UI**: Allow users to manually map inventory items to StockX products when automatic matching fails
3. **Cached Data Strategy**: Implement a fallback system that uses cached price data (from previous syncs) when live API doesn't find a match

## Testing

To test if the fix is working:

1. Open Portfolio → Inventory
2. Click "List on StockX" on an item with a valid SKU (e.g., DZ5485-612)
3. Modal should now show:
   - Lowest Ask
   - Highest Bid
   - Last Sale

If prices still show as dashes, check:
- Does the SKU exist on StockX website?
- Does the search return exact match in logs?

## Debug Script

Created `/scripts/test-stockx-skus.mjs` to test which SKUs work with StockX API.

## Server Restart

The dev server has been restarted with clean cache to ensure latest code is running:
```bash
rm -rf .next && npm run dev
```
