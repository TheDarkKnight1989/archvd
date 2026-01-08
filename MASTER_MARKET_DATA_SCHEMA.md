# Master Market Data Schema - Implementation Guide
**Date:** 2025-12-03
**Status:** Ready for Implementation

---

## Overview

This document describes the complete schema and implementation plan for the master market data plumbing layer.

---

## Database Schema

### Tables Created

1. **`stockx_raw_snapshots`** - Raw StockX API responses
2. **`alias_raw_snapshots`** - Raw Alias API responses
3. **`master_market_data`** - Unified normalized market data
4. **`master_market_latest`** (Materialized View) - Latest prices per provider/product/size

### Migrations

- ✅ `20251203_create_raw_snapshot_tables.sql` - Raw snapshot audit trail
- ✅ `20251203_create_master_market_data.sql` - Master market data table

---

## TypeScript Services Created

### Raw Snapshot Loggers

1. **`src/lib/services/raw-snapshots/stockx-logger.ts`**
   - `logStockXSnapshot()` - Direct logging function
   - `withStockXSnapshot()` - Wrapper for API calls

2. **`src/lib/services/raw-snapshots/alias-logger.ts`**
   - `logAliasSnapshot()` - Direct logging function
   - `withAliasSnapshot()` - Wrapper for API calls

---

## Integration Plan

### Step 1: Wrap Existing API Calls (TODO)

Update existing service files to use snapshot loggers:

#### StockX Services
- `src/lib/services/stockx/catalog.ts`
  - `searchProducts()` - Wrap with `withStockXSnapshot('catalog_search', ...)`
  - `getProduct()` - Wrap with `withStockXSnapshot('product', ...)`
  - `getProductVariants()` - Wrap with `withStockXSnapshot('variants', ...)`
  - `lookupByGTIN()` - Wrap with `withStockXSnapshot('variant_gtin', ...)`

- `src/lib/services/stockx/market.ts`
  - `getMarketDataForProduct()` - Wrap with `withStockXSnapshot('market_data', ...)`

#### Alias Services
- `src/lib/services/alias/client.ts`
  - `searchCatalog()` - Wrap with `withAliasSnapshot('catalog_search', ...)`
  - `getCatalogItem()` - Wrap with `withAliasSnapshot('catalog_item', ...)`
  - `listPricingInsights()` - Wrap with `withAliasSnapshot('pricing_availabilities', ...)`
  - `getPricingInsight()` - Wrap with `withAliasSnapshot('pricing_availability', ...)`

- **NEW:** `src/lib/services/alias/recent-sales.ts` (TO BE CREATED)
  - `getRecentSales()` - Implement Alias recent_sales endpoint

### Step 2: Create Ingestion Mappers (TODO)

Create services to transform raw snapshots → master_market_data:

#### StockX Ingestion Mapper
**File:** `src/lib/services/ingestion/stockx-mapper.ts`

```typescript
/**
 * Transform StockX market-data response to master_market_data rows
 */
export async function ingestStockXMarketData(
  rawSnapshotId: string,
  rawPayload: StockXMarketDataResponse,
  options: {
    currencyCode: string
    productId: string
    styleId?: string
  }
): Promise<void> {
  // For each variant in rawPayload.variants:
  // 1. Parse prices (STRING major units → NUMERIC)
  // 2. Extract volume data (salesLast72Hours, sales30Days)
  // 3. Insert into master_market_data with:
  //    - provider: 'stockx'
  //    - provider_source: 'stockx_market_data'
  //    - provider_product_id: productId
  //    - provider_variant_id: variant.id
  //    - size_key: variant.size
  //    - lowest_ask: parseFloat(variant.market.lowestAsk.amount)
  //    - currency_code: options.currencyCode
  //    - raw_snapshot_id: rawSnapshotId
  //    - raw_snapshot_provider: 'stockx'
}
```

#### Alias Ingestion Mapper
**File:** `src/lib/services/ingestion/alias-mapper.ts`

```typescript
/**
 * Transform Alias availabilities response to master_market_data rows
 */
export async function ingestAliasAvailabilities(
  rawSnapshotId: string,
  rawPayload: AliasAvailabilitiesResponse,
  options: {
    catalogId: string
    regionId?: string
  }
): Promise<void> {
  // For each variant in rawPayload.variants:
  // Filter to standard conditions (NEW + GOOD_CONDITION)
  // 1. Parse prices (STRING cents → NUMERIC major units)
  //    - parseInt(variant.availability.lowest_listing_price_cents) / 100
  // 2. Insert into master_market_data with:
  //    - provider: 'alias'
  //    - provider_source: 'alias_availabilities'
  //    - provider_product_id: catalogId (Alias doesn't have product vs catalog distinction)
  //    - provider_variant_id: null (Alias doesn't have variant IDs)
  //    - size_key: variant.size.toString()
  //    - size_numeric: variant.size
  //    - lowest_ask: parseInt(variant.availability.lowest_listing_price_cents) / 100
  //    - currency_code: 'USD' (Alias default)
  //    - region_code: options.regionId || 'global'
  //    - raw_snapshot_id: rawSnapshotId
  //    - raw_snapshot_provider: 'alias'
}

/**
 * Transform Alias recent_sales response to master_market_data rows
 */
export async function ingestAliasRecentSales(
  rawSnapshotId: string,
  rawPayload: AliasRecentSalesResponse,
  options: {
    catalogId: string
    regionId?: string
  }
): Promise<void> {
  // For each sale in rawPayload.recent_sales:
  // 1. Parse price (STRING cents → NUMERIC major units)
  // 2. Calculate volume metrics (group by size, count sales in last 72h/30d)
  // 3. Insert/update master_market_data with volume data
  //    - sales_last_72h: count where purchased_at > now() - 72h
  //    - sales_last_30d: count where purchased_at > now() - 30d
}
```

### Step 3: Backfill Script (TODO)

**File:** `scripts/backfill-master-market-data.ts`

```typescript
/**
 * Backfill master_market_data from existing tables
 *
 * 1. Read existing stockx_market_snapshots
 * 2. Read existing alias_market_snapshots
 * 3. Transform and insert into master_market_data
 * 4. Also process any new raw snapshots that haven't been ingested yet
 */
export async function backfillMasterMarketData() {
  // Step 1: Backfill from stockx_market_snapshots
  // Step 2: Backfill from alias_market_snapshots
  // Step 3: Process new raw snapshots
  // Step 4: Refresh master_market_latest materialized view
}
```

### Step 4: Validation Script (TODO)

**File:** `scripts/validate-master-market-data.ts`

```typescript
/**
 * Validate master_market_data for sample SKUs
 *
 * Test SKUs:
 * - Jordan 1: DD1391-100 (Panda)
 * - Jordan 4: DH6927-111 (Military Blue)
 * - Yeezy Slide: ID4133 (Bone)
 * - New Balance 990v6: M990GL6
 * - Pokemon: Sample TCG card
 */
export async function validateMasterMarketData() {
  const testSkus = [
    { sku: 'DD1391-100', size: '10.5', name: 'Jordan 1 Panda' },
    { sku: 'DH6927-111', size: '10', name: 'Jordan 4 Military Blue' },
    { sku: 'ID4133', size: '10', name: 'Yeezy Slide Bone' },
    { sku: 'M990GL6', size: '10', name: 'New Balance 990v6' },
  ]

  for (const test of testSkus) {
    console.log(`\n--- Testing: ${test.name} (${test.sku}, size ${test.size}) ---`)

    // Query master_market_latest for this SKU/size
    const prices = await getMasterMarketPrices(test.sku, test.size)

    // Verify:
    // 1. Both StockX and Alias have data
    // 2. Prices are in major units (not cents!)
    // 3. Currency codes are correct
    // 4. Region codes are present where applicable
    // 5. Timestamps are recent (< 1 hour old)
    // 6. No null/undefined in critical fields

    console.log('StockX:', prices.stockx)
    console.log('Alias:', prices.alias)
    console.log('Data quality:', validateDataQuality(prices))
  }
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL APIs (StockX, Alias)                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         │ API Call (wrapped with logger)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  RAW SNAPSHOT TABLES (Audit Trail)                               │
│  - stockx_raw_snapshots                                          │
│  - alias_raw_snapshots                                           │
│                                                                   │
│  Stores: Complete JSON response, HTTP status, timestamps         │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Ingestion Mapper (async, background)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  MASTER MARKET DATA (Normalized Layer)                           │
│  - master_market_data (time-series)                              │
│  - master_market_latest (materialized view)                      │
│                                                                   │
│  Stores: Normalized prices (major units), volumes, spreads       │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Query from app/UI (future step)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER (Not yet implemented)                         │
│  - Inventory table prices                                        │
│  - Archvd Price algorithm                                        │
│  - Price history charts                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Currency & Region Handling

### StockX
- **Currency:** Supports 12 currencies (USD, GBP, EUR, JPY, etc.)
- **Region:** NOT supported (currency is the only filter)
- **Units:** Major currency units (e.g., "145.00" = $145.00)
- **Storage:** Store as-is in `master_market_data.lowest_ask`

### Alias
- **Currency:** USD only (no multi-currency support in API)
- **Region:** Supports region filtering (us, uk, eu, global)
- **Units:** CENTS as STRINGS (e.g., "14500" = $145.00)
- **Storage:** Divide by 100 before storing in `master_market_data.lowest_ask`

### FX Conversion (Future)
- Use `fx_rate` column to convert to user's base currency
- Store both original and base currency prices:
  - `lowest_ask` - Original currency
  - `lowest_ask_base` - Converted to base currency
- FX rates fetched from `fx_rates` table (updated daily)

---

## Critical Implementation Notes

### ⚠️ CURRENCY UNITS - DO NOT MIX!

**StockX:**
```typescript
// ✅ CORRECT
const lowestAsk = parseFloat(response.market.lowestAsk.amount) // "145.00" → 145.00

// ❌ WRONG
const lowestAsk = parseFloat(response.market.lowestAsk.amount) * 100 // NO! Already major units!
```

**Alias:**
```typescript
// ✅ CORRECT
const lowestAsk = parseInt(response.availability.lowest_listing_price_cents) / 100 // "14500" → 145.00

// ❌ WRONG
const lowestAsk = parseInt(response.availability.lowest_listing_price_cents) // NO! Still in cents!
```

### ⚠️ SIZE HANDLING

**StockX:** Sizes are strings (may include system, e.g., "UK 9")
```typescript
size_key: "10.5"  or  "UK 9"
size_numeric: 10.5  or  9.0
size_system: "US"  or  "UK"
```

**Alias:** Sizes are numeric
```typescript
size_key: "10.5"  // Convert to string
size_numeric: 10.5  // Use as-is
size_system: "US"  // From catalog size_unit field
```

### ⚠️ CONDITION FILTERING (Alias Only)

Always filter to standard conditions:
```typescript
const STANDARD_CONDITIONS = {
  product_condition: "PRODUCT_CONDITION_NEW",
  packaging_condition: "PACKAGING_CONDITION_GOOD_CONDITION"
}
```

---

## Refresh Strategy

### Background Workers

1. **StockX Market Refresh** (Already exists: `src/lib/services/stockx/market-refresh.ts`)
   - Runs every 5-10 minutes via cron
   - **TODO:** Add raw snapshot logging
   - **TODO:** Add ingestion mapper call

2. **Alias Market Refresh** (DOES NOT EXIST - MUST CREATE)
   - Should run every 5-10 minutes via cron
   - Call `/api/v1/pricing_insights/availabilities/{catalogId}`
   - Log to `alias_raw_snapshots`
   - Run ingestion mapper to `master_market_data`

3. **Alias Recent Sales Fetch** (DOES NOT EXIST - MUST CREATE)
   - Should run every 15-30 minutes via cron
   - Call `/api/v1/pricing_insights/recent_sales`
   - Log to `alias_raw_snapshots`
   - Run ingestion mapper to update volume metrics

### Materialized View Refresh

Create cron job to refresh `master_market_latest`:
```sql
SELECT refresh_master_market_latest();
```

**Schedule:** Every 5-10 minutes (after data ingestion)

---

## Testing Checklist

- [ ] Raw snapshot tables created successfully
- [ ] Master market data table created successfully
- [ ] Materialized view created successfully
- [ ] StockX raw logger works (test with sample API call)
- [ ] Alias raw logger works (test with sample API call)
- [ ] StockX ingestion mapper correctly parses major units
- [ ] Alias ingestion mapper correctly converts cents → major units
- [ ] Alias recent_sales endpoint implemented
- [ ] Background refresh workers updated with logging
- [ ] Backfill script runs without errors
- [ ] Validation script shows correct data for test SKUs
- [ ] No currency unit mixing (all major units in master table)
- [ ] Materialized view refresh works
- [ ] Helper functions work (`get_latest_prices_for_product`, etc.)

---

## Next Steps (Post-Implementation)

1. **Wire Up to Inventory Table** (Future)
   - Update `useInventoryV3` to query `master_market_latest`
   - Replace direct queries to `stockx_market_latest` and `alias_market_snapshots`

2. **Implement Archvd Price Algorithm** (Future)
   - Volume-weighted composite price
   - Recency adjustments
   - Confidence scoring
   - Multi-provider price synthesis

3. **Add eBay Provider** (Future)
   - Create `ebay_raw_snapshots` table
   - Create eBay ingestion mapper
   - Add eBay-specific fields to `master_market_data`

4. **Performance Optimization** (Future)
   - Table partitioning by month
   - Archiving old snapshots (> 90 days)
   - Query optimization
   - Caching layer

---

## Files Delivered

### Documentation
- ✅ `STOCKX_ENDPOINTS_VERIFIED.md` - StockX API reference
- ✅ `ALIAS_ENDPOINTS_VERIFIED.md` - Alias API reference
- ✅ `MASTER_MARKET_DATA_SCHEMA.md` - This document

### Migrations
- ✅ `supabase/migrations/20251203_create_raw_snapshot_tables.sql`
- ✅ `supabase/migrations/20251203_create_master_market_data.sql`

### TypeScript Services
- ✅ `src/lib/services/raw-snapshots/stockx-logger.ts`
- ✅ `src/lib/services/raw-snapshots/alias-logger.ts`

### TODO (Next Phase)
- ❌ `src/lib/services/ingestion/stockx-mapper.ts` - TO BE CREATED
- ❌ `src/lib/services/ingestion/alias-mapper.ts` - TO BE CREATED
- ❌ `src/lib/services/alias/recent-sales.ts` - TO BE CREATED
- ❌ `scripts/backfill-master-market-data.ts` - TO BE CREATED
- ❌ `scripts/validate-master-market-data.ts` - TO BE CREATED

---

**Status:** Foundation complete, ready for Step 3 (ingestion mappers) and Step 5 (scripts)
