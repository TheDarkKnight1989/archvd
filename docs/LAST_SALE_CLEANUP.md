# Last Sale Field Cleanup

## Overview
StockX V2 API no longer provides `lastSale` / `last_sale_price` data. This document tracks all cleanup performed to remove these deprecated fields.

## Database Changes

### Migration: `20251120_remove_last_sale_price.sql`
- ✅ Drops `last_sale_price` column from `stockx_market_snapshots` table
- ✅ Recreates `stockx_market_latest` materialized view without `last_sale_price`
- ✅ Adds comment explaining why field was removed

## Code Changes Needed

### TypeScript Types (`src/lib/stockx/types.ts`)
**Lines to remove/deprecate:**
- Line 68: `lastSaleCents` field in `StockxRawVariant.market`
- Line 80: `lastSaleAmount` field in `StockxRawMarketDataItem`
- Line 169: `lastSalePrice` in domain types
- Line 183: `lastSalePriceByDay` array
- Line 462: `last_sale_price` in database schema types

### Mappers (`src/lib/stockx/mappers.ts`)
**Lines to remove:**
- Line 86: Comment about `lastSaleAmount`
- Line 98: `lastSalePrice: raw.lastSaleAmount` mapping

### Market Upsert (`src/lib/market/upsert.ts`)
**Lines to remove:**
- Line 15: `last_sale?: number` parameter
- Line 54: `last_sale: data.last_sale || null` usage
- Line 130: `lastSalePrice?: number | null` parameter
- Line 177: `last_sale_price: data.lastSalePrice ?? null` usage

### Provider Code (`src/lib/pricing/providers/stockx.ts`)
**Lines to update:**
- Line 69: Remove check for `v.lastSaleAmount`
- Lines 81-83: Remove `avgLastSale` calculation
- Line 85: Remove `avgLastSale` from price selection

### Worker Code (`src/lib/providers/stockx-worker.ts`)
**Lines to update:**
- Line 1034: Remove `last_sale_price` from destructuring
- Lines 1124-1125: Update price selection comment and remove `snapshot.last_sale_price`

### Scripts to Update
- `scripts/sync-stockx-real.mjs`: Lines 183, 187-188, 200
- `scripts/add-seed-prices.mjs`: Lines 18-27, 58, 76, 78
- `scripts/check-currency-data.mjs`: Lines 32, 46, 57-58, 78-79
- `scripts/sync-portfolio-market-data.mjs`: Line 156 ✅ (Already has note: "V2 API doesn't provide lastSale")

### Hooks (`src/hooks/useStockxListings.ts`)
- Line 98: Remove comment about `last_sale_price`

## Files to Leave As-Is (Archive/Fixtures)
These are test data/archived files, safe to leave:
- `fixtures/alias/market/mock-prod-*.json` - Mock test data
- `supabase/archive/seed-catalog-sample.sql` - Archived seed data

## Verification Steps

1. ✅ Migration created: `supabase/migrations/20251120_remove_last_sale_price.sql`
2. ⏳ **Apply migration** - Run via Supabase SQL Editor (Dashboard → SQL Editor):
   ```sql
   -- Drop the view first
   DROP VIEW IF EXISTS stockx_market_latest CASCADE;

   -- Remove last_sale_price column
   ALTER TABLE stockx_market_snapshots DROP COLUMN IF EXISTS last_sale_price CASCADE;

   -- Recreate view without last_sale_price
   CREATE VIEW stockx_market_latest AS
   SELECT DISTINCT ON (stockx_product_id, stockx_variant_id, currency_code)
     id, stockx_product_id, stockx_variant_id, product_id, variant_id,
     currency_code, sales_last_72_hours, total_sales_volume, lowest_ask,
     highest_bid, average_deadstock_price, volatility, price_premium,
     snapshot_at, created_at
   FROM stockx_market_snapshots
   ORDER BY stockx_product_id, stockx_variant_id, currency_code, snapshot_at DESC;

   -- Add comment
   COMMENT ON VIEW stockx_market_latest IS 'Latest market data snapshot for each product/variant/currency (excludes last_sale_price as StockX V2 API no longer provides it)';
   ```
3. ⏳ Remove TypeScript type references
4. ⏳ Update code that tries to use lastSale
5. ⏳ Run type check: `npm run typecheck`
6. ⏳ Test portfolio sync still works with updated schema

## Notes

- The V2 API now only provides: `lowestAskAmount` and `highestBidAmount`
- Historical sales data is NOT available via the current API
- Portfolio sync script already handles this correctly (line 156)
