# ALIAS V4 API - COMPLETE DATA VERIFICATION

**Date:** 2025-12-09
**Purpose:** Verify all available data from Alias API before schema design

---

## VERIFICATION SUMMARY

✅ **All API endpoints tested and verified**
✅ **All data structures documented**
✅ **All edge cases identified**
✅ **Ready for schema design**

---

## 1. CATALOG DATA (Products)

**Endpoint:** `GET /catalog?query={sku}` and `GET /catalog/{catalog_id}`

**Verified Fields:**
```typescript
{
  catalog_id: string              // "dunk-low-black-white-dd1391-100"
  name: string                    // "Nike Dunk Low 'Black White'"
  sku: string                     // "DD1391 100" (WITH SPACE, not hyphen)
  brand: string                   // "Nike"
  gender: string                  // "men", "women", "unisex"
  release_date: string            // "2021-03-10T23:59:59.999Z" (ISO 8601)
  product_category: string        // "PRODUCT_CATEGORY_SHOES"
  product_category_v2: string     // "shoes" (preferred)
  product_type: string            // "sneakers"
  size_unit: string               // "SIZE_UNIT_US"
  colorway: string                // "White/Black/White"
  nickname: string                // "Black White"
  retail_price_cents: string      // "10000" (as string)
  minimum_listing_price_cents: string  // "2500"
  maximum_listing_price_cents: string  // "200000"
  main_picture_url: string        // Image URL
  requires_listing_pictures: boolean
  resellable: boolean

  allowed_sizes: Array<{
    display_name: string          // "10"
    value: number                 // 10
    us_size_equivalent: number    // 10
  }>

  requested_pictures: Array<{
    type: string                  // "PICTURE_TYPE_OUTER"
    quantity: string              // "1" (as string)
  }>
}
```

**Notes:**
- SKU format: "DD1391 100" (space, not hyphen)
- All price fields are STRINGS representing cents
- catalog_id is the primary identifier (stable, never changes)

---

## 2. PRICING INSIGHTS - VARIANTS

**Endpoint:** `GET /pricing_insights/availabilities/{catalog_id}`

**Query Parameters:**
- `region_id` (optional): '1'=US, '2'=EU, '3'=UK, empty=global
- `consigned` (optional): true/false, omit for both

**Verified Variant Structure:**
```typescript
{
  size: number                    // 10
  product_condition: string       // "PRODUCT_CONDITION_NEW"
  packaging_condition: string     // "PACKAGING_CONDITION_GOOD_CONDITION"
  consigned: boolean              // Only present when consigned param used

  availability: {
    lowest_listing_price_cents: string       // "9600"
    highest_offer_price_cents: string        // "10500"
    last_sold_listing_price_cents: string    // "11500"
    global_indicator_price_cents: string     // "0"
  }
}
```

**Product Conditions:**
- `PRODUCT_CONDITION_NEW` - Brand new with no defects
- `PRODUCT_CONDITION_USED` - Previously used or worn
- `PRODUCT_CONDITION_NEW_WITH_DEFECTS` - Unused but has factory defect

**Packaging Conditions:**
- `PACKAGING_CONDITION_GOOD_CONDITION` - Excellent condition, minimal wear
- `PACKAGING_CONDITION_MISSING_LID` - Box lid missing
- `PACKAGING_CONDITION_BADLY_DAMAGED` - Significant damage
- `PACKAGING_CONDITION_NO_ORIGINAL_BOX` - No original packaging

**CRITICAL FINDINGS:**
- ✅ availability object has EXACTLY 4 fields (confirmed across all query types)
- ❌ NO `number_of_listings` field exists
- ❌ NO `number_of_offers` field exists
- ❌ NO depth/volume metrics in this endpoint
- Price of "0" means no data available for that metric

---

## 3. RECENT SALES (Sales History)

**Endpoint:** `GET /pricing_insights/recent_sales`

**DOCUMENTED vs ACTUAL BEHAVIOR:**

**Pattern #1 (Catalog Item Sales):**
- **Documentation says:** catalog_id + consigned (must be non-null)
- **ACTUAL API BEHAVIOR:** Returns 400 "Missing parameter: input.Size"
- **VERDICT:** ⚠️ Documentation error - Pattern #1 does NOT work

**Pattern #2 (Single Variant Sales):**
- **Required:** catalog_id + size + product_condition + packaging_condition
- **Optional:** consigned, region_id, limit
- **VERDICT:** ✅ WORKS - This is the only way to get recent sales

**Working Example:**
```
GET /pricing_insights/recent_sales
  ?catalog_id=dunk-low-black-white-dd1391-100
  &size=10
  &product_condition=PRODUCT_CONDITION_NEW
  &packaging_condition=PACKAGING_CONDITION_GOOD_CONDITION
  &limit=10
```

**Verified Response Structure:**
```typescript
{
  recent_sales: Array<{
    purchased_at: string          // "2025-12-09T18:24:08.701Z" (ISO 8601)
    price_cents: string           // "6500"
    size: number                  // 10
    consigned: boolean            // true/false
    catalog_id: string            // "dunk-low-black-white-dd1391-100"
  }>
}
```

**Notes:**
- Results are ordered by purchased_at DESC (most recent first)
- This is the ONLY source of sales volume/history data
- Must query per variant (size + condition) - cannot get all sizes at once
- Default limit: 10, Max limit: 200 (when all filters provided)

---

## 4. OFFER HISTOGRAM

**Endpoint:** `GET /pricing_insights/offer_histogram`

**Required Parameters:**
- catalog_id
- size
- product_condition
- packaging_condition
- region_id (optional)

**Verified Response Structure:**
```typescript
{
  offer_histogram: {
    bins: Array<{
      offer_price_cents: string   // "5500"
      count: string               // "1"
    }>
  }
}
```

**Notes:**
- Bins are sorted from highest price to lowest
- Bins are dynamically generated based on current market data
- Both price and count are STRINGS, not numbers
- Shows offer depth at specific price points

---

## 5. PRICING INSIGHTS - SINGLE VARIANT

**Endpoint:** `GET /pricing_insights/availability`

**Required Parameters:**
- catalog_id
- size
- product_condition
- packaging_condition

**Response:** Same structure as variants[n].availability from List Pricing Insights

---

## COMPARISON WITH STOCKX V4

| Feature | Alias V4 | StockX V4 |
|---------|----------|-----------|
| **Catalog ID** | catalog_id (string slug) | productId (UUID) |
| **Variant ID** | Composite (catalog_id+size+conditions) | variantId (UUID) |
| **Price Fields** | 4 fields (always strings) | Multiple nested objects |
| **Depth Metrics** | ❌ Not available | ✅ numberOfAsks, numberOfBids |
| **Sales History** | ✅ recent_sales endpoint | ✅ sales endpoint |
| **Offer Histogram** | ✅ Available | ❌ Not in V4 |
| **Currency** | Always USD | Per-region currencies |
| **Consigned Flag** | At variant level | Not exposed |
| **Regions** | '1','2','3' | Different structure |

---

## SCHEMA DESIGN IMPLICATIONS

### 1. PRODUCTS TABLE
Store catalog metadata - maps directly to catalog endpoints

### 2. VARIANTS TABLE
**CRITICAL DECISION:** Alias has no variant UUID like StockX
- Option A: Create composite key (catalog_id + size + product_condition + packaging_condition + consigned)
- Option B: Generate our own UUID as PK, add unique constraint on composite
- **RECOMMENDATION:** Option B for consistency with StockX pattern

### 3. MARKET DATA TABLE
Store current pricing (4 fields + currency_code)
- UPSERT pattern with 24hr TTL
- PK: (variant_id, currency_code)

### 4. PRICE HISTORY TABLE
Store snapshots from market_data
- INSERT-only (append-only log)
- Index on (variant_id, recorded_at)

### 5. SALES HISTORY TABLE (NEW - not in StockX)
Store recent_sales data
- This is unique to Alias - StockX doesn't expose this level of detail
- INSERT-only (append-only)
- Fields: variant_id, purchased_at, price_cents, consigned

### 6. OFFER HISTOGRAM TABLE (NEW - not in StockX)
Store offer depth data
- UPSERT pattern (replace all bins per variant)
- Fields: variant_id, offer_price_cents, count, updated_at

---

## DATA GAPS (Compared to StockX)

**Missing from Alias:**
1. ❌ numberOfListings / numberOfAsks - Not available
2. ❌ numberOfOffers / numberOfBids - Not available
3. ❌ Sales volume count - Must calculate from recent_sales endpoint
4. ❌ Media/images at variant level - Only main_picture_url at product level
5. ❌ Barcodes/GTINs - Not provided
6. ❌ Fees/payout calculations - Not provided

**Unique to Alias:**
1. ✅ Offer histogram - Shows offer depth distribution
2. ✅ Detailed recent sales - Per-variant sales history with timestamps
3. ✅ Consigned flag - Distinguishes consigned vs regular inventory
4. ✅ Global indicator price - Helps with cross-region pricing

---

## READY FOR SCHEMA DESIGN

✅ All endpoints tested
✅ All data structures verified
✅ All edge cases documented
✅ API documentation errors identified
✅ Comparison with StockX complete

**Next Step:** Create 20251209_create_inventory_v4_alias_schema.sql
