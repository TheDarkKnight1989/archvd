# Phase 3.10: Fix Invalid StockX Product Mapping + 404 Handling

## Problem Statement

Phase 3.9 revealed that HQ6998-600 (Chicago Low) has an invalid StockX product mapping:
- **Current Product ID**: `83c11c36-1e00-4831-85e5-6067abf2f18b`
- **StockX API Response**: `404 Resource not found`
- **Impact**: Cannot fetch fresh market data; Portfolio shows stale prices from existing snapshots

## Root Cause

The `stockx_product_id` stored in `inventory_market_links` table is no longer valid on StockX. Product IDs can become invalid when:
1. StockX deprecates old product entries
2. Product gets migrated to a new ID in their system
3. Product is delisted/removed

## Where the Broken Mapping Lives

**Table**: `inventory_market_links`
**Columns**:
- `item_id`: UUID of the inventory item (e.g., `729d9d3d-b9e2-4f1e-8286-e235624b2923`)
- `stockx_product_id`: The invalid product ID (`83c11c36-1e00-4831-85e5-6067abf2f18b`)
- `stockx_variant_id`: Variant ID for specific size

**Affected Items** (HQ6998-600):
1. UK 9: `729d9d3d-b9e2-4f1e-8286-e235624b2923`
2. UK 11: `85a1fbbd-b271-4961-b65b-4d862ec2ac23`

## Solution Implemented

### 1. Remap Utility Script

**File**: [scripts/remap-stockx-product.mjs](../scripts/remap-stockx-product.mjs)

**Purpose**: Fix broken StockX product mappings when product IDs become invalid

**How it works**:
1. Queries `Inventory` table for all items with given SKU
2. Shows current mappings from `inventory_market_links`
3. Searches StockX V2 API for matching products
4. Lets user select the correct product
5. Fetches variants (sizes) for the selected product
6. Updates `inventory_market_links` with new product_id and variant_ids

**Usage**:
```bash
node scripts/remap-stockx-product.mjs <SKU>
```

**Example**:
```bash
node scripts/remap-stockx-product.mjs HQ6998-600
```

### 2. Current Blocker: StockX API Access Issue

When testing the remap script with HQ6998-600, discovered:
- **StockX V2 Search API** also returns `404` for `/v2/search?query=HQ6998-600`
- **StockX V2 Market API** returns `404` for `/v2/catalog/products/{productId}/market`

This suggests one of:
1. StockX V2 API endpoints have changed
2. API key doesn't have access to V2 endpoints
3. Need different authentication method for V2

**Current workaround**: The database still has snapshot data from when the mapping WAS valid (2025-11-20 09:25), so the prices shown are recent but cannot be refreshed.

## Manual Remap Instructions (Until API Issue is Resolved)

Since the automated remap script hits the same API 404, you can manually update the mapping:

### Step 1: Find the Correct Product ID on StockX Website

1. Go to https://stockx.com
2. Search for "Air Jordan 1 Low Chicago" or "HQ6998-600"
3. Open the product page
4. Look at the URL - it will be like: `https://stockx.com/air-jordan-1-low-og-chicago-XXXXXX`
5. The product ID is in the URL or you can inspect the page source for `productUUID`

### Step 2: Update the Database

Connect to your Supabase database and run:

```sql
-- Update the product ID for HQ6998-600 items
UPDATE inventory_market_links
SET
  stockx_product_id = '<NEW_PRODUCT_ID_HERE>',
  updated_at = NOW()
WHERE item_id IN (
  '729d9d3d-b9e2-4f1e-8286-e235624b2923',  -- UK 9
  '85a1fbbd-b271-4961-b65b-4d862ec2ac23'   -- UK 11
);
```

**Note**: You'll also need to get the correct `stockx_variant_id` for each size. You can find these by:
1. Using browser DevTools on StockX product page
2. Looking at the Network tab when selecting different sizes
3. Finding the variant IDs in the API responses

### Step 3: Trigger a Sync

After updating the mapping:

```bash
curl -X POST http://localhost:3000/api/stockx/sync/prices
```

This will:
1. Fetch market data using the new product ID
2. Create fresh snapshots in `stockx_market_snapshots`
3. Refresh the `stockx_market_latest` materialized view
4. Portfolio will show updated prices

## 404 Handling Improvements Needed

Currently, when a product ID returns 404:
- The sync worker catches the error and marks the job as "failed"
- But there's no clear indication in the UI that the mapping is broken
- "Last checked X minutes ago" can be misleading (shows last attempt, not last success)

**Recommended improvements**:

### 1. Add Mapping Status Field

```sql
ALTER TABLE inventory_market_links
ADD COLUMN mapping_status TEXT DEFAULT 'active';
-- Values: 'active', 'invalid_404', 'rate_limited', 'api_error'

ALTER TABLE inventory_market_links
ADD COLUMN last_sync_success_at TIMESTAMPTZ;

ALTER TABLE inventory_market_links
ADD COLUMN last_sync_error TEXT;
```

### 2. Update Worker to Track 404s

In `src/lib/providers/stockx-worker.ts`, when calling the market API:

```typescript
try {
  const marketData = await marketService.getProductMarket(productId)

  // Update mapping as active on success
  await supabase
    .from('inventory_market_links')
    .update({
      mapping_status: 'active',
      last_sync_success_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq('stockx_product_id', productId)

} catch (error) {
  // Check if it's a 404
  if (error.message?.includes('404') || error.status === 404) {
    console.error(`[Phase 3.10] Product ID ${productId} returned 404 - mapping is invalid`)

    // Mark mapping as invalid
    await supabase
      .from('inventory_market_links')
      .update({
        mapping_status: 'invalid_404',
        last_sync_error: `Product not found on StockX (404)`,
      })
      .eq('stockx_product_id', productId)

    return {
      status: 'stockx_404',
      productId,
      inventoryItemId: item.id,
      message: 'StockX product mapping is invalid (404). Run remap script to fix.',
    }
  }

  throw error // Other errors still throw
}
```

### 3. Surface Status in Portfolio UI

Add a badge/icon for items with broken mappings:
- "⚠️ Mapping broken - needs remap"
- "🔄 Last sync X days ago"
- Link to remap instructions

## Verification Steps (After Remap)

1. **Check database has new mappings**:
   ```sql
   SELECT item_id, stockx_product_id, stockx_variant_id, updated_at
   FROM inventory_market_links
   WHERE item_id IN (
     '729d9d3d-b9e2-4f1e-8286-e235624b2923',
     '85a1fbbd-b271-4961-b65b-4d862ec2ac23'
   );
   ```

2. **Verify StockX API returns 200**:
   ```bash
   node scripts/debug-chicago-low-prices.mjs
   ```
   - Should show "✅ Raw StockX API Response" (not 404)

3. **Check fresh snapshots exist**:
   ```sql
   SELECT stockx_product_id, stockx_variant_id, lowest_ask, highest_bid, snapshot_at
   FROM stockx_market_snapshots
   WHERE stockx_product_id = '<NEW_PRODUCT_ID>'
   ORDER BY snapshot_at DESC
   LIMIT 5;
   ```

4. **Verify Portfolio shows different prices**:
   - Open Portfolio page
   - Chicago Low UK 9 should show different price than UK 11
   - Compare with StockX website to ensure accuracy

## Files Created/Modified

### Created:
1. `scripts/remap-stockx-product.mjs` - Product remapping utility
2. `docs/PHASE_3.10_STOCKX_404_HANDLING.md` - This document

### To Modify (404 handling improvements):
1. `src/lib/providers/stockx-worker.ts` - Add 404 detection and status tracking
2. `supabase/migrations/` - Add mapping_status columns
3. Portfolio UI components - Show mapping status badges

## Current Status

- ✅ Remap utility script created
- ✅ Problem diagnosed (invalid product ID + API 404s)
- ⚠️  **BLOCKER**: StockX V2 API returning 404 for both search and market endpoints
- ⏸️  Cannot test automated remap until API access is resolved
- 📝 Manual remap instructions provided as workaround

## Next Steps

**Option A: Fix StockX API Access**
1. Investigate why V2 endpoints return 404
2. Check API key permissions
3. Review StockX V2 API documentation for changes
4. Test with different authentication method if needed

**Option B: Manual Remap (Immediate)**
1. Find correct product ID on StockX website manually
2. Update `inventory_market_links` table directly (SQL above)
3. Trigger sync to fetch fresh data
4. Verify Portfolio shows correct, different prices for each size

**Option C: Add 404 Handling (Parallel Work)**
1. Add `mapping_status` column to `inventory_market_links`
2. Update worker to detect and log 404s
3. Surface broken mappings in Portfolio UI
4. This will help catch future mapping issues early

## Acceptance Criteria (Not Yet Met)

- [ ] HQ6998-600 items map to a valid StockX product (returns 200, not 404)
- [ ] Fresh snapshots exist for both UK 9 and UK 11
- [ ] Portfolio shows **different** prices for UK 9 vs UK 11
- [ ] Prices match StockX website for those sizes
- [ ] 404s are clearly logged and surfaced (not silent failures)
- [ ] Remap script successfully runs end-to-end

**Reason Not Met**: StockX V2 API access issue prevents automated remap and sync.
