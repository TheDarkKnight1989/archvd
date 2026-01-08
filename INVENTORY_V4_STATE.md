# Inventory V4 - Current State

**Last Updated:** 2025-12-09
**Phase:** API Discovery Complete - Awaiting Schema Decisions
**Status:** Real API responses captured and saved

---

## 🎯 Project Goal

Rebuild inventory system (V4) with:
- Clean namespace (`inventory_v4_*` for all tables/scripts/hooks)
- StockX as first provider (hybrid cache-first architecture)
- Correct data units (major units, not cents)
- Validated API responses before building anything

---

## ✅ What's Been VALIDATED & APPROVED

### Documentation
- ✅ **STOCKX_V4_API_MASTER_REFERENCE.md** - Created from official StockX docs
  - Contains: Authentication, Rate Limits, Catalog Search API, Market Data API
  - **CRITICAL FINDING:** StockX prices are STRINGS in MAJOR UNITS ("100" = $100.00, NOT cents)

### APIs Documented (5 core APIs) ✅
1. ✅ **Catalog Search API** - `GET /v2/catalog/search` → Search by SKU, get productId
2. ✅ **Product Details API** - `GET /v2/catalog/products/{productId}` → Get product info
3. ✅ **Product Variants API** - `GET /v2/catalog/products/{productId}/variants` → Get all variantIds + sizes
4. ✅ **Variant by GTIN API** - `GET /v2/catalog/products/variants/gtins/{gtin}` → Barcode scanner lookup
5. ✅ **Market Data API** - `GET /v2/catalog/products/{productId}/variants/{variantId}/market-data` → Get prices

### API Discovery Complete ✅
- ✅ **Real API Responses Captured** - All 4 working APIs tested with Nike Dunk Low Panda (DD1391-100)
- ✅ **Data saved to:** `api-responses/inventory_v4_stockx/`
  - `01_catalog_search.json` - Search returns `products` array (NOT `data`)
  - `02_product_details.json` - Full product with title, brand, colorway, releaseDate, retailPrice
  - `03_product_variants.json` - Array of 21+ sizes with variantIds, size conversions, GTINs
  - `05_market_data.json` - Prices as STRINGS ("36", "133"), earnMore/sellFaster suggestions
- ✅ **Key Findings:**
  - Prices confirmed as STRINGS in MAJOR UNITS ✅
  - Default currency is USD (need to specify GBP region)
  - Market data has 3 tiers: standard, flex, direct
  - Variants have complete size conversions (US M, US W, UK, EU, CM, KR)
  - GTINs available per size for barcode scanning

**Pipeline Flow Validated:**
- User adds item by SKU → Catalog Search → productId
- Fetch all sizes → Product Variants → array of (variantId, size, gtins, conversions)
- Fetch prices per size → Market Data → lowestAsk, highestBid, earnMore, sellFaster
- Store in `inventory_v4_market_data` table

---

## ⚠️ What's NOT TRUSTED / NOT VALIDATED

### Schema
- ⚠️ **`supabase/migrations/20251208_create_inventory_v4_schema.sql`**
  - Status: EXISTS but NOT VALIDATED
  - Problem: Created before API verification
  - Action: DO NOT USE until API responses are verified
  - Will be rebuilt after API validation

### Old Code
- ⚠️ All V3 code is broken (wrong column names, unit confusion)
- ⚠️ `src/lib/services/stockx/market.ts` - May have unit conversion issues
- ⚠️ `src/hooks/useInventoryV3.ts` - Quick fix applied but still using old tables

---

## 📋 Current Phase: Building Migration

### What We Just Completed ✅
- ✅ Built master API reference from official StockX docs
- ✅ Created API discovery script (`scripts/inventory_v4_stockx_api_discovery.mjs`)
- ✅ Called real StockX APIs and captured complete raw responses
- ✅ Verified data units: Prices are STRINGS in MAJOR UNITS ✅
- ✅ Validated response structures (found multiple differences from assumptions)
- ✅ User reviewed raw responses and decided on schema
- ✅ **SCHEMA FROZEN** - 5 tables finalized (see below)

### 🔒 FROZEN SCHEMA PLAN (DO NOT CHANGE)

**Architecture:** Global Catalog (products/variants shared across users)

**5 Tables:**
1. `inventory_v4_stockx_products` - Product metadata (global)
2. `inventory_v4_stockx_variants` - Size catalog (global)
3. `inventory_v4_stockx_market_data` - Current pricing (UPSERT, 24hr TTL)
4. `inventory_v4_stockx_price_history` - Historical snapshots (INSERT only)
5. `inventory_v4_stockx_user_inventory` - User ownership

**Fields (from validated API responses):**
- Products: productId, brand, title, styleId, productType, urlKey, colorway, gender, releaseDate, retailPrice, isFlexEligible, isDirectEligible
- Variants: variantId, productId (FK), variantName, variantValue, sizeChart (JSONB), gtins (JSONB), isFlexEligible, isDirectEligible
- Market Data: variantId (FK), currencyCode (GBP default), highestBid, lowestAsk, flexLowestAsk, earnMore, sellFaster, standardMarketData (JSONB), flexMarketData (JSONB), directMarketData (JSONB), lastUpdated, expiresAt
- Price History: variantId (FK), currencyCode, highestBid, lowestAsk, recordedAt (no UNIQUE, just index)
- User Inventory: userId, variantId (FK), quantity, purchasePrice, condition, notes, listingStatus, listedAt

**Data Types:**
- Prices: NUMERIC(12,2) (convert from STRING "27" → 27.00)
- Text: TEXT (not enums)
- Currency: TEXT, default 'GBP'
- Timestamps: TIMESTAMPTZ

**Multi-Provider Ready:** Option C (separate tables + view when adding Alias)

### What's Next (IN ORDER)
1. ✅ **Build Migration** - COMPLETE: `supabase/migrations/20251209_create_inventory_v4_schema.sql`
2. 🔨 **Apply Migration** - Create v4 tables in database ← **AWAITING APPROVAL**
3. 🔨 **Build Sync Script** - Fetch → Transform → Store pipeline
4. 🔨 **Test** - Verify data is correct
5. 🔨 **Build UI** - Display page for inventory-v4
6. 🔨 **Hook up modals** - Connect list/delist to v4 tables

---

## 🚫 What NOT to Do

1. ❌ DO NOT apply migrations without approval
2. ❌ DO NOT build schema without API validation
3. ❌ DO NOT trust old broken code as reference
4. ❌ DO NOT assume data formats - verify everything
5. ❌ DO NOT rush - validate each step

---

## 💬 User Feedback Pattern

User has repeatedly asked to:
- ✅ Slow down and validate first
- ✅ Build from official docs, not broken code
- ✅ Use namespace for everything (`inventory_v4_*`)
- ✅ Get approval before applying database changes
- ✅ Map out plans step-by-step before building

---

## 📝 Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Which provider first? | StockX | Primary marketplace for users |
| Architecture? | Hybrid cache-first | Check cache (24hr TTL) → API on miss |
| Namespace? | `inventory_v4_*` | Complete isolation from broken V3 |
| Schema trust? | NOT TRUSTED | Built before API validation |
| Currency? | **GBP PRIMARY (UK-based)** | ⚠️ DEFAULT TO GBP, NOT USD |
| Region Priority? | UK → EU → US | 🇬🇧 GBP → 🇪🇺 EUR → 🇺🇸 USD |

---

## 🔍 Open Questions

1. ✅ **RESOLVED:** Use Product Variants API to get variantIds
2. ✅ **RESOLVED:** API discovery complete - all 4 working APIs tested
3. **Schema Fields?** Which fields from API responses should be included in V4 schema?
   - Product: title? brand? colorway? gender? releaseDate? retailPrice? urlKey?
   - Variants: gtins? isFlexEligible? isDirectEligible? size conversions?
   - Market Data: earnMore/sellFaster suggestions? flex/direct pricing tiers?
4. **Region Handling?** Market data returned USD - need to test GBP region parameter?

---

## 📦 File Locations

### Documentation (Trusted)
- `/Users/ritesh/Projects/archvd/STOCKX_V4_API_MASTER_REFERENCE.md` ✅
- `/Users/ritesh/Projects/archvd/INVENTORY_V4_STATE.md` ✅ (this file)

### API Discovery (NEW - Validated)
- `/Users/ritesh/Projects/archvd/scripts/inventory_v4_stockx_api_discovery.mjs` ✅
- `/Users/ritesh/Projects/archvd/api-responses/inventory_v4_stockx/01_catalog_search.json` ✅
- `/Users/ritesh/Projects/archvd/api-responses/inventory_v4_stockx/02_product_details.json` ✅
- `/Users/ritesh/Projects/archvd/api-responses/inventory_v4_stockx/03_product_variants.json` ✅
- `/Users/ritesh/Projects/archvd/api-responses/inventory_v4_stockx/05_market_data.json` ✅

### Schema (Validated ✅)
- `/Users/ritesh/Projects/archvd/supabase/migrations/20251209_create_inventory_v4_schema.sql` ✅ **NEW - FROZEN SCHEMA**

### Old Schema (NOT Trusted - TO BE DELETED)
- `/Users/ritesh/Projects/archvd/supabase/migrations/20251208_create_inventory_v4_schema.sql` ⚠️ DELETE THIS

### Old Code (Reference only, not trusted)
- `/Users/ritesh/Projects/archvd/src/lib/services/stockx/market.ts`
- `/Users/ritesh/Projects/archvd/src/hooks/useInventoryV3.ts`
- `/Users/ritesh/Projects/archvd/docs/STOCKX_README.md`

---

## 🔄 Before Context Expires

**CRITICAL:** Update this file with:
1. Current phase
2. What was just completed
3. What's next
4. Any new decisions/approvals
5. Any new open questions

**USER MUST APPROVE before:**
- Applying migrations
- Creating new tables
- Building data pipelines
- Making any database changes

---

**Next Action Required:** User to review raw API responses in `api-responses/inventory_v4_stockx/` and decide which fields to include in V4 schema.
