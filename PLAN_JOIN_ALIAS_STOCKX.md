# Plan: Joining Alias and StockX Data in Inventory V4

**Status: IMPLEMENTED + AUDITED** (2025-12-11)
**Approach: Simple SQL Function + TypeScript Service (no materialized views)**

## Architecture

```
SKU ("DD1391-100")
       │
       ▼
style_catalog (style_id PK)
       │
   ┌───┴───┐
   ▼       ▼
stockx_   alias_
product   catalog
   │       │
   ▼       ▼
stockx_   alias_
variants  variants
   │       │
   └───┬───┘
       │
  JOIN ON SIZE
  (TEXT↔NUMERIC)
       │
       ▼
  Unified row per size
```

## Key Differences

| Aspect | StockX | Alias |
|--------|--------|-------|
| Variant ID | UUID from API | Synthetic BIGSERIAL |
| Size Format | TEXT ("10") | NUMERIC (10.0) |
| Currency | GBP (user's region) | Always USD |
| Regions | Single (user's) | Multi (UK/EU/US) |
| Consignment | N/A | Yes (new vs consigned) |
| Flex Pricing | Yes | No |

## Implementation

### Files Created

1. **Migration**: `supabase/migrations/20251211_unified_market_data.sql`
   - `get_unified_market_data(p_style_id, p_alias_region, p_consigned)` - Single SKU
   - `get_unified_market_data_batch(p_style_ids, p_sizes, p_alias_region)` - Multiple SKUs
   - Indexes for join optimization

2. **TypeScript Service**: `src/lib/services/unified-market/index.ts`
   - `getUnifiedMarketData()` - RPC wrapper
   - `getUnifiedMarketDataBatch()` - Batch RPC wrapper
   - `getUnifiedMarketDataDirect()` - Fallback direct query

3. **React Hook**: `src/hooks/useUnifiedMarketData.ts`
   - `useUnifiedMarketData({ styleId, aliasRegion })` - Component hook
   - `findBestAsk(row)` / `findBestBid(row)` - Helpers

### Why Not Materialized Views?

1. **Data model still shifting** - Region mapping, currency handling, size normalization still being discovered
2. **Heavy machinery = more failure modes** - View refresh, cron jobs, stale data debugging
3. **Performance not needed yet** - ~50 items, not 10,000
4. **Shape not locked** - Consigned handling, region preferences may change

### When to Add Heavy Machinery

Convert the SQL function to a materialized view when:
- Inventory table has 500+ items with noticeable latency
- Dashboard needs aggregations across 100k+ SKUs
- The unified row shape has been stable for 2+ months

## Decisions Made

1. **Default region**: UK (region_id='1')
2. **Currency display**: Native currency shown, FX conversion in application layer
3. **Consigned data**: Filtered to `consigned=false` by default (parameter to include)
4. **Join method**: SQL function with TypeScript fallback

## Audit Fixes Applied (2025-12-11)

1. **Alias nested relation bug**: Fixed `[0]` indexing for Supabase nested selects (returns arrays)
2. **Consigned param**: Added `p_consigned` parameter to batch SQL function
3. **Pagination**: Added `p_limit` parameter (default 500) to batch SQL function
4. **Log prefixes**: Improved to `[UnifiedMarket:single/batch/direct]`
5. **FX conversion docs**: Added JSDoc example showing `useCurrency` hook usage
6. **Region type docs**: Added reference to `getAliasRegion()` utility for type conversion
7. **TypeScript types**: Added explicit type annotations for untyped Supabase queries
8. **Cross-join bug**: Rewrote batch function using `CROSS JOIN LATERAL` to reuse single-SKU function, avoiding Cartesian product between StockX and Alias sizes

## Usage Examples

```typescript
// Single SKU (Market Inspector, Product Detail)
const { data, loading, error } = useUnifiedMarketData({
  styleId: 'DD1391-100',
  aliasRegion: '1', // UK
})

// Batch (Inventory Table)
const result = await getUnifiedMarketDataBatch(supabase, {
  styleIds: ['DD1391-100', 'DZ5485-612'],
  sizes: ['10', '10.5', '11'],
  aliasRegion: '1',
  consigned: false, // default
})

// FX Conversion for price comparison
const { convert } = useCurrency()
const stockxUSD = convert(row.stockx_lowest_ask, 'GBP', 'USD')
const aliasUSD = row.alias_lowest_ask // already USD
```
