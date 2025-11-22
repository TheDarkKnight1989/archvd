# StockX Contract Layer Implementation

## Summary

Created a proper abstraction layer between raw StockX API responses and the application's domain model. This prevents field name mismatches and centralizes all API contract knowledge.

## Changes Made

### 1. Raw API Types (`src/lib/stockx/types.ts`)

Added raw types that match exact StockX JSON responses:

- `StockxRawSearchResponse` - Search endpoint response
- `StockxRawProduct` - Product from search
- `StockxRawVariant` - Variant/size data
- `StockxRawMarketDataItem` - Market data for a variant
- `StockxRawListing` - Listing data
- `StockxRawListingCreated` - Listing creation response

**Key field discoveries:**
- SKU field: `styleId` (NOT `sku`)
- Product ID: `productId` (UUID)
- Prices: `lastSaleAmount`, `lowestAskAmount`, `highestBidAmount` (in currency units, NOT cents)
- Size: `variantValue` or `size`

### 2. Mapper Functions (`src/lib/stockx/mappers.ts`)

Created explicit mapping functions:

```typescript
// Search
mapSearchResponse(raw) → StockxSearchResult
mapRawProductToDomain(raw) → StockxProduct

// Catalog
mapRawVariantToDomain(raw) → StockxVariant
mapRawMarketDataToDomain(raw, currency) → StockxMarketData

// Listings
mapRawListingToDomain(raw) → StockxListing
mapRawListingCreatedToDomain(raw) → StockxListingCreated

// Helpers
findProductByStyleId(response, styleId) → StockxRawProduct | null
findVariantBySize(variants, size) → StockxRawVariant | null
findMarketDataByVariantId(data, variantId) → StockxRawMarketDataItem | null
```

**Field Mappings:**

| Raw API Field | Domain Type Field | Notes |
|--------------|-------------------|-------|
| `styleId` | `styleId` | SKU/style code |
| `productId` | `productId` | UUID |
| `productAttributes.colorway` | `colorway` | Nested → flat |
| `productAttributes.retailPrice` | `retailPrice` | Nested → flat |
| `productAttributes.releaseDate` | `releaseDate` | Nested → flat |
| `media.imageUrl` | `imageUrl` | Nested → flat |
| `lastSaleAmount` | `lastSalePrice` | Renamed for clarity |
| `lowestAskAmount` | `lowestAsk` | Simplified name |
| `highestBidAmount` | `highestBid` | Simplified name |
| `variantValue` | `variantValue` | Size display value |
| `amountCents` | `amount` | Listing price |

### 3. Fixtures (`tests/fixtures/stockx/`)

Added real API response examples:

- `search-response.json` - Actual search result
- `market-data-response.json` - Actual market data array

These fixtures document the real API structure for reference.

### 4. Tests (`tests/unit/stockx-mappers.test.ts`)

Created unit tests that verify:

✅ Search response mapping
✅ Product field extraction (styleId, productId, nested attributes)
✅ Market data mapping (prices, volume, statistics)
✅ Helper functions (findByStyleId, etc.)

**Run tests:**
```bash
npx tsx tests/unit/stockx-mappers.test.ts
```

All tests passing ✅

### 5. Refactoring Guide for API Routes

**Before** (❌ Direct raw API access):
```typescript
const searchResponse = await client.request<any>(...)
const products = searchResponse?.products || []
const match = products.find((p: any) =>
  p.styleId === productId ||  // Hard-coded field names
  p.styleID === productId ||
  p.style_id === productId
)
```

**After** (✅ Using mappers):
```typescript
import { findProductByStyleId, mapRawProductToDomain } from '@/lib/stockx/mappers'
import type { StockxRawSearchResponse } from '@/lib/stockx/types'

const rawResponse = await client.request<StockxRawSearchResponse>(...)
const rawProduct = findProductByStyleId(rawResponse, productId)

if (rawProduct) {
  const product = mapRawProductToDomain(rawProduct)
  // Now use product.styleId, product.productId, etc.
}
```

## Contract Stability Rules

From now on, if you discover a field mismatch:

1. **Update `StockxRaw*` type** - Fix the raw type to match reality
2. **Update mapper function** - Adjust the mapping logic
3. **Update fixture** - Add/fix the example data
4. **Run tests** - Verify expectations still pass

**Never:**
- Patch field names directly in UI components
- Patch field names in API routes
- Assume field names without checking raw response

## Benefits

✅ **Single source of truth** for API contract
✅ **Type safety** - TypeScript catches mismatches
✅ **Testable** - Mappers can be unit tested
✅ **Discoverable** - New developers can see exact API structure
✅ **Maintainable** - Changes in one place (mappers)
✅ **No more ad-hoc fixes** - Stop discovering field mismatches in production

## Files Created/Modified

**New files:**
- `src/lib/stockx/mappers.ts` - Mapper functions
- `tests/fixtures/stockx/search-response.json` - Real search response
- `tests/fixtures/stockx/market-data-response.json` - Real market data
- `tests/unit/stockx-mappers.test.ts` - Unit tests
- `docs/STOCKX_CONTRACT_LAYER.md` - This document

**Modified:**
- `src/lib/stockx/types.ts` - Added raw API types

**To be refactored:**
- `src/app/api/stockx/products/[productId]/market-data/route.ts` - Use mappers
- `src/app/api/stockx/search/route.ts` - Use mappers
- Any other files directly accessing raw StockX responses

## Next Steps

1. Refactor `market-data/route.ts` to use `findProductByStyleId` and `mapRawMarketDataToDomain`
2. Refactor `search/route.ts` to use `mapSearchResponse`
3. Grep codebase for direct `.styleId`, `.productId` access outside mappers
4. Update those to use domain types instead

## Testing

```bash
# Run mapper tests
npx tsx tests/unit/stockx-mappers.test.ts

# Should see:
# ✅ All tests passed!
# Key field mappings verified:
#   • styleId → styleId (SKU)
#   • productId → productId (UUID)
#   • lastSaleAmount → lastSalePrice
#   • lowestAskAmount → lowestAsk
#   • highestBidAmount → highestBid
```

## Field Reference Card

Quick reference for developers:

```typescript
// ✅ Correct (in mappers only)
raw.styleId        // SKU
raw.productId      // UUID
raw.lastSaleAmount // Price
raw.lowestAskAmount
raw.highestBidAmount

// ✅ Correct (everywhere else)
product.styleId       // From domain type
product.productId
marketData.lastSalePrice
marketData.lowestAsk
marketData.highestBid

// ❌ Wrong (never use these)
raw.sku              // Field doesn't exist
raw.style_id         // Field doesn't exist
raw.styleID          // Field doesn't exist
product.lastSaleAmount // Use lastSalePrice in domain
```
