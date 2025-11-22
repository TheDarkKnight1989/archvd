# Highest Bid Fix - Complete Summary

## Problem

The user reported that `highest_bid` values were showing incorrectly in the portfolio table. After investigation, we discovered a **data source mismatch** in the frontend code.

## Root Cause

The application has **two parallel data structures** for StockX market data:

### Old Structure (SKU-based)
- **Table**: `stockx_market_prices`
- **View**: `stockx_latest_prices` (reads from `stockx_market_prices`)
- **Purpose**: Legacy system, still used by some parts of the app
- **Problem**: Not being updated by the new StockX V2 worker

### New Structure (UUID-based) - CORRECT
- **Table**: `stockx_market_snapshots`
- **View**: `stockx_market_latest` (reads from `stockx_market_snapshots`)
- **Purpose**: Current StockX V2 integration architecture
- **Worker**: Correctly writes data with `highestBidAmount` → `highest_bid`

**The Issue**: Frontend hooks were querying the **old view** (`stockx_latest_prices`) instead of the **new view** (`stockx_market_latest`), causing them to read stale/incorrect data.

## Verification of API Field Names

✅ **Confirmed**: The StockX V2 API returns:
- `highestBidAmount` (NOT `highestBid` or `highestBidCents`)
- `lowestAskAmount` (NOT `lowestAsk` or `lowestAskCents`)

All mappers and workers were already correctly using these field names.

## Files Modified

### 1. `/src/hooks/usePortfolioInventory.ts`
**Changes:**
- Changed query from `stockx_latest_prices` → `stockx_market_latest`
- Updated fields: `sku, size, as_of` → `stockx_product_id, stockx_variant_id, snapshot_at`
- Updated price lookup to use `product_id:variant_id` keys instead of `sku:size`
- Fixed field references: `as_of` → `snapshot_at`, `currency` → `currency_code`

### 2. `/src/hooks/useDashboardData.ts`
**Changes:**
- Changed query from `stockx_latest_prices` → `stockx_market_latest`
- Updated fields: `sku, size, as_of` → `stockx_product_id, stockx_variant_id, snapshot_at`
- Updated price lookup to use `product_id:variant_id` keys instead of `sku:size`
- Fixed field references: `as_of` → `snapshot_at`

### 3. `/src/app/api/portfolio/overview/route.ts`
**Status**: ✅ Already correct - was using `stockx_market_latest`

## Verification

### Data Pipeline Confirmed Working:

1. **API Mapping** ✅
   - `/src/lib/stockx/mappers.ts` line 100: `highestBid: raw.highestBidAmount`
   - Correctly maps API field name to domain type

2. **Service Layer** ✅
   - `/src/lib/services/stockx/market.ts` line 218: `highestBid: raw.highestBidAmount`
   - Correctly normalizes V2 API data

3. **Worker** ✅
   - `/src/lib/providers/stockx-worker.ts` line 220: `highestBid: marketData.highestBid`
   - Correctly writes to snapshots table

4. **Database Upsert** ✅
   - `/src/lib/market/upsert.ts` line 168: `highest_bid: data.highestBid`
   - Correctly writes to `stockx_market_snapshots.highest_bid` column

5. **Database Schema** ✅
   - `/supabase/migrations/20251120_stockx_integration.sql` line 121: `highest_bid DECIMAL(10, 2)`
   - Column exists and is correctly typed

6. **Materialized View** ✅
   - Line 159: `highest_bid` included in view SELECT
   - View correctly exposes the field

### Data Refresh

Ran `/scripts/sync-portfolio-market-data.mjs` to fetch fresh data:
- ✅ Successfully synced 9 items across 8 products
- ✅ All items now have correct `highest_bid` values in database
- ✅ Data written to `stockx_market_snapshots` table
- ✅ `stockx_market_latest` view shows current data

Sample verified data (GBP):
```
Product      | Variant    | Lowest Ask | Highest Bid | Timestamp
-------------|------------|------------|-------------|-------------------
0a57fd91...  | d9f975ab...| £98        | £72         | 2025-11-20 16:17:58
e4b11157...  | 3491a282...| £148       | £111        | 2025-11-20 16:17:56
5bbcafa8...  | 64c90bc2...| £4272      | £742        | 2025-11-20 16:17:54
83c11c36...  | 48af2a2e...| £121       | £97         | 2025-11-20 16:17:53
83c11c36...  | 5c9c0e3c...| £124       | £97         | 2025-11-20 16:17:53
44d8eef8...  | 24d5265b...| £253       | £129        | 2025-11-20 16:17:51
9a4d44f9...  | efa55889...| £271       | £156        | 2025-11-20 16:17:49
5e6a1e57...  | a2ea632e...| £61        | £21         | 2025-11-20 16:17:48
08a9310b...  | 5ff93930...| £11416     | N/A         | 2025-11-20 16:17:46
```

## Testing

The user should now see correct `highest_bid` values in:
1. Portfolio table (`/portfolio`)
2. Portfolio overview/KPIs (`/portfolio`)
3. Dashboard widgets (if using `useDashboardData`)

The frontend will now correctly display:
- **Market Value** = `lowest_ask ?? highest_bid ?? null`
- **Highest Bid** = `highest_bid` (from database)
- **Lowest Ask** = `lowest_ask` (from database)

## Architecture Notes

### Current State
- ✅ **StockX V2 Integration** uses `stockx_market_snapshots` table (UUID-based)
- ✅ **Portfolio Views** now read from `stockx_market_latest` view
- ⚠️  **Legacy `stockx_market_prices` table** still exists but is not updated by workers

### Recommendation
Consider deprecating the old `stockx_market_prices` / `stockx_latest_prices` structures once all code paths are migrated to use `stockx_market_latest`. This will:
1. Reduce confusion about which data source to use
2. Eliminate duplicate table maintenance
3. Simplify the schema

### Data Flow (Current)
```
StockX V2 API
    ↓
    highestBidAmount, lowestAskAmount
    ↓
Service Layer (market.ts)
    ↓
    highestBid, lowestAsk (domain types)
    ↓
Worker (stockx-worker.ts)
    ↓
Database Upsert (upsert.ts)
    ↓
stockx_market_snapshots table
    ↓
stockx_market_latest view
    ↓
Frontend Hooks (usePortfolioInventory, useDashboardData)
    ↓
UI Components
```

## Conclusion

✅ **Issue Fixed**: Frontend now reads from correct data source
✅ **Data Verified**: Database contains correct `highest_bid` values
✅ **Architecture Documented**: Clear understanding of data flow
✅ **Scripts Added**: Refresh and verification scripts created

The `highest_bid` field was always correct in the database - the issue was that the frontend was reading from the wrong table/view. Now that the frontend queries `stockx_market_latest`, users will see accurate bid prices.
