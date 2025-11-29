# StockX Listing Visibility Fix

## Problem Summary

Listings were being successfully created on StockX API and saved to `stockx_listings` table, but were NOT visible in the UI.

## Root Cause

**ACTUAL ROOT CAUSE (discovered 2025-11-23)**: Missing RLS UPDATE policy on `inventory_market_links`

The real issue was that authenticated users had SELECT permission but NOT UPDATE permission on `inventory_market_links`. The [20251119_fix_inventory_market_links_rls.sql](../supabase/migrations/20251119_fix_inventory_market_links_rls.sql) migration only created a SELECT policy, missing UPDATE/INSERT/DELETE.

When the create listing endpoint tried to update `stockx_listing_id`, it failed silently due to missing RLS permissions.

**Previous suspected bugs** (these were red herrings - the code is actually correct):

1. **Wrong column name**: Code used `listing_id` but table column is `stockx_listing_id` ❌ FALSE - code already uses correct column
2. **Non-existent column filter**: Code filtered by `.eq('marketplace', 'stockx')` ❌ FALSE - this filter was already removed

## Fixes Applied

### 1. Fixed RLS policies (ACTUAL FIX - 2025-11-23)
**Migration**: [supabase/migrations/20251123_fix_inventory_market_links_update_policy.sql](../supabase/migrations/20251123_fix_inventory_market_links_update_policy.sql)

Added missing UPDATE, INSERT, and DELETE RLS policies for authenticated users on `inventory_market_links`.

**How to apply**:
```bash
# Copy the SQL from the migration file and run it in Supabase SQL Editor
# Or use Supabase CLI:
npx supabase db execute --file supabase/migrations/20251123_fix_inventory_market_links_update_policy.sql
```

**What changed**:
- Before: Only SELECT policy existed for authenticated users
- After: Full CRUD policies (SELECT, UPDATE, INSERT, DELETE) for authenticated users
- Result: Users can now update `stockx_listing_id` when creating listings

### 2. (Previous suspected fix - NOT the actual issue)
**File**: [src/app/api/stockx/listings/create/route.ts](../src/app/api/stockx/listings/create/route.ts#L183-L192)

The code was already correct:
```typescript
const { error: linkError } = await supabase
  .from('inventory_market_links')
  .update({ stockx_listing_id: listingId })  // ✅ Already correct!
  .eq('item_id', inventoryItemId)  // ✅ Already correct!
```

### 2. Backfilled existing listings
**Script**: [scripts/backfill-listing-links.mjs](../scripts/backfill-listing-links.mjs)

Updated `inventory_market_links` table to populate `stockx_listing_id` for the 3 orphaned listings that were created before the fix.

### 3. Fixed price display bug (£1,193.96 instead of £1500)
**Files**:
- [src/hooks/useInventoryV3.ts](../src/hooks/useInventoryV3.ts#L432)
- [src/hooks/usePortfolioInventory.ts](../src/hooks/usePortfolioInventory.ts#L247)
- [src/app/portfolio/inventory/_components/InventoryV3Table.tsx](../src/app/portfolio/inventory/_components/InventoryV3Table.tsx#L330)

**Root Cause 1 - Missing cents conversion**: Database stores prices in INTEGER cents (150000 for £1500), but hooks were displaying without conversion, showing £119,395.76.

**Fix in hooks**:
```typescript
// BEFORE:
askPrice: listing?.amount || null, // FIX: Already in major units ❌ WRONG!

// AFTER:
askPrice: listing?.amount ? listing.amount / 100 : null, // Convert cents to pounds
```

**Root Cause 2 - Incorrect USD→GBP conversion**: After fixing the cents conversion, the table was treating GBP listing prices as USD and converting them to GBP (1500 * 0.7964 = £1,193.96).

**Fix in InventoryV3Table.tsx line 330**:
```typescript
// BEFORE:
const converted = convert(askPrice, 'USD') // StockX prices are USD ❌ WRONG for listings!

// AFTER:
// Listing prices are already in GBP (from StockX API), no conversion needed
```

**Impact**: Listings were showing £1,193.96 instead of £1500.00. This bug was caused by treating already-GBP listing prices as USD and applying currency conversion. This affected the InventoryV3 table view.

## Testing

### Verify fix worked:
```bash
node scripts/check-inventory-links.mjs
```

Should show listings with `stockx_listing_id` populated.

### Create new listing:
1. Go to inventory page
2. Select an item that's mapped to StockX
3. Click "List on StockX"
4. Create listing
5. Check that `stockx_listing_id` is populated in `inventory_market_links`

## Database State After Fix

- **stockx_listings table**: 3 listings exist (all PENDING status, £1500 each)
- **inventory_market_links**: Updated with most recent listing ID (`0e7bc72a-edb5-4e09-9dc5-3c8514a6e089`)
- **Future listings**: Will correctly update the link on creation

## Notes

### Multiple Listings Per Item
The schema has a UNIQUE constraint on `item_id` in `inventory_market_links`, which means only ONE active listing can be tracked per inventory item. If multiple listings exist for the same item (as happened during testing), only the most recent one will be linked.

This is by design to prevent inventory tracking issues. Future work could support multiple active listings per item if needed.

### UI Display
Listings are displayed in two places:
1. **Dedicated Listings Page**: `/portfolio/stockx-listings` - Shows all listings from `stockx_listings` table
2. **Inventory Page**: `/portfolio/inventory` - Shows listing status via `inventory_market_links` join

After the fix, new listings should appear in both views.

## Related Files

- [src/app/api/stockx/listings/create/route.ts](../src/app/api/stockx/listings/create/route.ts) - Create listing endpoint (FIXED)
- [src/hooks/useStockxListings.ts](../src/hooks/useStockxListings.ts) - Hook for fetching/displaying listings
- [supabase/migrations/20251120_stockx_integration.sql](../supabase/migrations/20251120_stockx_integration.sql#L519-L528) - Schema definition
- [scripts/check-inventory-links.mjs](../scripts/check-inventory-links.mjs) - Diagnostic script
- [scripts/backfill-listing-links.mjs](../scripts/backfill-listing-links.mjs) - Backfill script

## Status

✅ **FIXED** - New listings will now be visible immediately after creation
✅ **BACKFILLED** - Existing 3 listings have been linked and should now be visible
