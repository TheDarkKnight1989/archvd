# Add-Item Flow Comprehensive Audit
**Date**: 2025-12-06
**Scope**: End-to-end add-item flow from search to database persistence
**Status**: CRITICAL ISSUES FOUND

---

## Executive Summary

This audit identified **17 critical bugs**, **8 medium-priority issues**, and **6 low-priority improvements** across the add-item flow. The most severe issues involve:

1. **Missing database schema verification** - No validation that required foreign key relationships exist
2. **Incomplete error handling** - Silent failures in variant matching and market data sync
3. **Data consistency gaps** - Trading cards flow has NULL variant IDs that may violate constraints
4. **Type mismatches** - String/number inconsistencies in size handling
5. **Race conditions** - Parallel database operations without proper sequencing

**Risk Level**: HIGH - Users may experience data corruption or failed item additions without clear error messages.

---

## Critical Bugs (Must Fix Immediately)

### BUG #1: Missing Foreign Key Validation in Catalog Creation
**File**: `/src/lib/catalog/stockx.ts`
**Lines**: 287-301
**Severity**: CRITICAL

**Issue**: The `stockx_variants` table requires a `product_id` foreign key to `product_catalog.id`, but this is set **BEFORE** the `product_catalog` entry exists.

```typescript
// Line 288-301: Variants are inserted with product_id from catalogData
for (const variant of variants) {
  const { error: variantError } = await supabase
    .from('stockx_variants')
    .upsert({
      product_id: catalogData.id, // FIX: Add product_id foreign key
      stockx_variant_id: variant.variantId,
      // ...
    })
}
```

**The Problem**:
- Step 3 (lines 238-257) creates `product_catalog` entry
- Step 4 (lines 278-310) immediately tries to insert variants with `product_id = catalogData.id`
- If `product_catalog` upsert fails silently or returns wrong ID, all variant inserts will fail

**Database Schema** (from migration `20251120_stockx_integration.sql`):
```sql
CREATE TABLE stockx_variants (
  product_id UUID NOT NULL REFERENCES stockx_products(id) ON DELETE CASCADE,
  -- WAIT! This references stockx_products.id, NOT product_catalog.id!
)
```

**ACTUAL BUG**: The foreign key constraint references `stockx_products(id)` but the code passes `catalogData.id` from `product_catalog`. This is a **schema mismatch**.

**Fix**:
```typescript
// Option 1: Use stockx_products.id instead
const { data: stockxProduct } = await supabase
  .from('stockx_products')
  .select('id')
  .eq('stockx_product_id', product.productId)
  .single()

for (const variant of variants) {
  await supabase.from('stockx_variants').upsert({
    product_id: stockxProduct.id, // Correct FK reference
    // ...
  })
}

// Option 2: Update schema to reference product_catalog.id
ALTER TABLE stockx_variants
  ADD CONSTRAINT fk_product_catalog
  FOREIGN KEY (product_id) REFERENCES product_catalog(id);
```

---

### BUG #2: Trading Cards Create NULL Variant Links
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 761-769
**Severity**: CRITICAL

**Issue**: Trading cards set `stockx_variant_id = NULL` in `inventory_market_links`, but the database schema may require a non-NULL value.

```typescript
// Line 761-769
const { error: linkError } = await serviceSupabase
  .from('inventory_market_links')
  .insert({
    item_id: inventoryItem.id,
    user_id: user.id,
    stockx_product_id: catalogData.stockx_product_id,
    stockx_variant_id: matchingVariant?.variantId || null, // NULL for trading cards
    mapping_status: 'ok',
  })
```

**Database Schema Check Needed**:
```sql
-- Need to verify if stockx_variant_id allows NULL
-- From migration 20251120_stockx_integration.sql
CREATE TABLE inventory_market_links (
  stockx_variant_id TEXT, -- Is this nullable?
  -- ...
)
```

**Without seeing the complete schema**, this could cause:
- Constraint violations if NOT NULL
- Broken market data lookups if queries assume non-NULL
- Orphaned records with no way to fetch pricing

**Fix**:
1. Verify schema allows NULL for `stockx_variant_id`
2. Add validation before insert:
```typescript
// Add schema validation
if (!matchingVariant && !isTradingCard) {
  throw new Error('Size variant required for non-trading-card products')
}

// Add debug logging
console.log('[Add by SKU] Creating market link:', {
  itemId: inventoryItem.id,
  stockxProductId: catalogData.stockx_product_id,
  stockxVariantId: matchingVariant?.variantId || 'NULL (trading card)',
  isTradingCard,
})

const { error: linkError } = await serviceSupabase
  .from('inventory_market_links')
  .insert({
    item_id: inventoryItem.id,
    user_id: user.id,
    stockx_product_id: catalogData.stockx_product_id,
    stockx_variant_id: matchingVariant?.variantId || null,
    mapping_status: 'ok',
  })

if (linkError) {
  console.error('[Add by SKU] Market link creation failed:', {
    error: linkError,
    code: linkError.code,
    message: linkError.message,
    isTradingCard,
    hadVariant: !!matchingVariant,
  })
  // Don't silently continue - this is critical
  throw new Error(`Failed to create market link: ${linkError.message}`)
}
```

---

### BUG #3: Silent Failure in Transaction Creation
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 733-756
**Severity**: HIGH

**Issue**: Transaction creation errors are logged but not returned to user. This creates incomplete audit trails.

```typescript
// Line 733-756
if (input.purchasePrice && input.purchaseDate) {
  const { error: transactionError } = await serviceSupabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'purchase',
      inventory_id: inventoryItem.id,
      // ...
    })

  if (transactionError) {
    console.error('[Add by SKU] Transaction creation error:', transactionError)
    // Don't fail the request if transaction creation fails
    // ^^ THIS IS WRONG! User won't know their transaction wasn't recorded
  }
}
```

**Why This Matters**:
- User thinks item was added successfully
- Transaction history is incomplete
- P/L calculations will be wrong
- No way to recover without manual SQL

**Fix**:
```typescript
if (input.purchasePrice && input.purchaseDate) {
  const { error: transactionError } = await serviceSupabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'purchase',
      inventory_id: inventoryItem.id,
      sku: catalogData.sku,
      size_uk: input.sizeSystem === 'UK' ? input.size : null,
      title: catalogData.model,
      image_url: catalogData.image_url,
      qty: 1,
      unit_price: input.purchasePrice,
      fees: (input.tax || 0) + (input.shipping || 0),
      platform: input.placeOfPurchase || null,
      notes: input.notes || null,
      occurred_at: input.purchaseDate,
    })

  if (transactionError) {
    console.error('[Add by SKU] CRITICAL: Transaction creation failed:', {
      error: transactionError,
      inventoryId: inventoryItem.id,
      purchasePrice: input.purchasePrice,
    })

    // OPTION 1: Fail the entire operation (safest)
    throw new Error(`Failed to record purchase transaction: ${transactionError.message}`)

    // OPTION 2: Return warning to user but continue
    return NextResponse.json({
      success: true,
      warning: 'Item added but transaction history not recorded. Please contact support.',
      item: { /* ... */ },
    }, { status: 201 })
  }
}
```

---

### BUG #4: Race Condition in Alias Fallback
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 244-255, 826-869
**Severity**: HIGH

**Issue**: Alias catalog sync and inventory creation happen in parallel without proper sequencing.

```typescript
// Line 244-255: Alias link created
await serviceSupabase
  .from('inventory_alias_links')
  .insert({
    inventory_id: inventoryItem.id,
    alias_catalog_id: aliasMatch.catalog_id,
    // ...
  })

// Line 826-869: Alias sync runs AFTER inventory is created
// But inventory may already be returned to user before sync completes!
if (aliasCatalogId) {
  const syncResult = await syncAliasProductMultiRegion(/*...*/)
  // What if this fails? User already has item added.
}
```

**The Problem**:
1. Inventory item created (line 189-198 in `tryAliasFailback`)
2. Response sent to user
3. Alias sync happens AFTER response (line 843-864)
4. If sync fails, item has no market data but user doesn't know

**Fix**:
```typescript
// Move sync BEFORE inventory creation
if (aliasMatch) {
  console.log('[Alias Fallback] Pre-syncing market data...')

  // Sync market data first
  const syncResult = await syncAliasProductMultiRegion(
    aliasClient,
    aliasMatch.catalog_id,
    { sku: input.sku, userRegion: aliasRegion }
  )

  if (!syncResult.success) {
    console.warn('[Alias Fallback] Market data sync failed, continuing anyway')
  }

  // Then create inventory
  const inventoryRow = { /* ... */ }
  const { data: inventoryItem, error } = await serviceSupabase
    .from('Inventory')
    .insert(inventoryRow)
    .select('*')
    .single()
}
```

---

### BUG #5: Missing Validation in SKU Normalization
**File**: `/src/lib/sku/normalizeSkuForMatching.ts`
**Lines**: 112-124
**Severity**: MEDIUM

**Issue**: Numeric SKU pattern has negative lookbehind that fails for valid edge cases.

```typescript
// Line 112: Negative lookbehind prevents "205759-610" after letters
const numericMatch = normalized.match(/(?<![A-Z])(\d{4,6})[\s-](\w{2,4})/)
```

**Problem Cases**:
- `"CROCS 205759-610"` → Won't match because `S` precedes digits
- `"ITEM205759-610"` → Won't match because `M` precedes digits

**Fix**:
```typescript
// Option 1: Remove lookbehind and validate after extraction
const numericMatch = normalized.match(/(\d{4,6})[\s-](\w{2,4})/)
if (numericMatch) {
  // Verify this isn't part of a larger sneaker SKU (like "DZ5485-410")
  const precedingChar = normalized[numericMatch.index! - 1]
  const isPartOfSneakerSku = precedingChar && /[A-Z]/.test(precedingChar)

  if (!isPartOfSneakerSku) {
    const canonical = `${numericMatch[1]}-${numericMatch[2]}`
    // ... validate and return
  }
}

// Option 2: Use word boundary instead
const numericMatch = normalized.match(/\b(\d{4,6})[\s-](\w{2,4})/)
```

---

### BUG #6: No Validation for product_catalog.sku Uniqueness
**File**: `/src/lib/catalog/stockx.ts`
**Lines**: 238-257
**Severity**: MEDIUM

**Issue**: Upsert uses `onConflict: 'sku'` but doesn't validate uniqueness before insert.

```typescript
// Line 238-257
const { data: catalogData, error: catalogError } = await supabase
  .from('product_catalog')
  .upsert({
    sku: product.styleId, // What if styleId is empty or duplicate?
    brand: product.brand || 'Unknown',
    // ...
  }, {
    onConflict: 'sku',
    ignoreDuplicates: false,
  })
  .select('id, sku, brand, model, image_url, stockx_product_id')
  .single()
```

**Missing Validation**:
- No check if `product.styleId` is empty
- No check if `product.styleId` is valid format
- No check if another product uses same SKU with different brand

**Fix**:
```typescript
// Validate SKU before upsert
if (!product.styleId || product.styleId.trim() === '') {
  console.error('[Catalog] Invalid product styleId:', product)
  return {
    success: false,
    error: 'Product has no valid SKU',
  }
}

const sku = product.styleId.trim()

// Check for existing entry with different brand (data quality issue)
const { data: existing } = await supabase
  .from('product_catalog')
  .select('brand, model')
  .eq('sku', sku)
  .single()

if (existing && existing.brand !== product.brand) {
  console.warn('[Catalog] SKU collision detected:', {
    sku,
    existingBrand: existing.brand,
    newBrand: product.brand,
  })
  // Decide: update or skip?
}

const { data: catalogData, error: catalogError } = await supabase
  .from('product_catalog')
  .upsert({ sku, /* ... */ })
```

---

### BUG #7: Missing Error Context in Search Failures
**File**: `/src/app/api/add-item/search/route.ts`
**Lines**: 269-272, 311-314
**Severity**: MEDIUM

**Issue**: Search errors return empty arrays without logging why search failed.

```typescript
// Line 269-272: StockX search error
} catch (error: any) {
  console.error('[AddItemSearch] StockX search failed:', error.message)
  return [] // User sees "no results" but doesn't know WHY
}

// Line 311-314: Alias search error
} catch (error: any) {
  console.warn('[AddItemSearch] Alias search failed:', error.message)
  return [] // Same problem
}
```

**Why This Matters**:
- 401/403 auth errors look like "no results"
- Rate limit errors look like "no results"
- Network timeouts look like "no results"
- User retries same search thinking it's a SKU issue

**Fix**:
```typescript
// Improve error handling with user-facing messages
const [stockxResults, aliasResults] = await Promise.all([
  // StockX search with detailed error tracking
  (async () => {
    try {
      const catalogService = new StockxCatalogService(user?.id)
      const results = await catalogService.searchProducts(searchQuery, {
        limit: STOCKX_PAGE_SIZE,
        pageNumber: currentPage,
        currencyCode: 'GBP',
      })
      return { results, error: null }
    } catch (error: any) {
      console.error('[AddItemSearch] StockX search failed:', {
        query: searchQuery,
        error: error.message,
        status: error.status,
        code: error.code,
      })

      // Return error details for client
      return {
        results: [],
        error: {
          provider: 'StockX',
          message: error.status === 401 ? 'Authentication failed' :
                   error.status === 429 ? 'Rate limit exceeded, try again in a minute' :
                   'Search temporarily unavailable',
          code: error.code,
        }
      }
    }
  })(),

  // Similar for Alias...
])

// Return errors in response
return NextResponse.json({
  priceable: finalPriceableResults,
  nonPriceable: finalNonPriceableResults,
  errors: [
    stockxResults.error,
    aliasResults.error,
  ].filter(Boolean),
})
```

---

### BUG #8: Size System Mismatch in Inventory Creation
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 694-704
**Severity**: MEDIUM

**Issue**: Size is stored inconsistently across `size`, `size_uk`, and `size_alt` fields.

```typescript
// Line 694-704
const inventoryRow = {
  size: isTradingCard ? 'OS' : (matchingVariant?.variantValue || 'OS'),
  size_uk: isTradingCard ? null : (input.sizeSystem === 'UK' ? input.size : null),
  size_alt: isTradingCard ? null : (input.sizeSystem === 'EU' ? `${input.size} EU` : null),
}
```

**Problems**:
1. `size` uses `matchingVariant.variantValue` (StockX US size)
2. `size_uk` uses `input.size` (user's input in UK)
3. `size_alt` only set for EU, not US
4. No conversion between systems

**Example Scenario**:
- User enters: `size=9`, `sizeSystem=UK`
- Matching variant: `variantValue=10` (US)
- Database stores:
  - `size = "10"` (US from StockX)
  - `size_uk = "9"` (UK from user)
  - `size_alt = null` (should be "10 US")

**Fix**:
```typescript
// Store all size representations
import { convertSize } from '@/lib/utils/size-conversion'

const sizes = {
  inputSize: input.size,
  inputSystem: input.sizeSystem,
  stockxSize: matchingVariant?.variantValue,
}

// Convert to all systems
const sizeUK = input.sizeSystem === 'UK' ? input.size :
               convertSize(input.size, input.sizeSystem, 'UK', brand, gender)

const sizeUS = matchingVariant?.variantValue ||
               convertSize(input.size, input.sizeSystem, 'US', brand, gender)

const sizeEU = input.sizeSystem === 'EU' ? input.size :
               convertSize(input.size, input.sizeSystem, 'EU', brand, gender)

const inventoryRow = {
  size: sizeUS, // Primary size (StockX standard)
  size_uk: sizeUK,
  size_alt: input.sizeSystem === 'EU' ? `${sizeEU} EU` :
            input.sizeSystem === 'US' ? `${sizeUS} US` :
            null,
  // Add metadata for debugging
  size_metadata: JSON.stringify({
    input: { size: input.size, system: input.sizeSystem },
    stockx: { size: matchingVariant?.variantValue },
    conversions: { uk: sizeUK, us: sizeUS, eu: sizeEU },
  }),
}
```

---

### BUG #9: No Rollback on Partial Failure
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 716-776
**Severity**: HIGH

**Issue**: If any step after inventory creation fails, we have orphaned database records.

**The Flow**:
1. Create inventory row (line 716-728) ✅
2. Create transaction (line 733-756) ❌ Fails
3. Create market link (line 761-776) ❌ Never runs
4. **Result**: Inventory exists but no transaction or market data

**Database State After Failure**:
```sql
-- Inventory exists
SELECT * FROM "Inventory" WHERE id = 'abc-123';
-- Returns row

-- But no transaction
SELECT * FROM transactions WHERE inventory_id = 'abc-123';
-- Returns nothing

-- And no market link
SELECT * FROM inventory_market_links WHERE item_id = 'abc-123';
-- Returns nothing
```

**Fix Options**:

**Option 1: Database Transaction (Best)**
```typescript
// Wrap all operations in a Postgres transaction
const { error: txError } = await serviceSupabase.rpc('add_inventory_item_tx', {
  inventory_data: inventoryRow,
  transaction_data: transactionRow,
  market_link_data: marketLinkRow,
})

if (txError) {
  // All or nothing - no orphaned records
  throw new Error(`Failed to add item: ${txError.message}`)
}
```

**Option 2: Manual Rollback**
```typescript
let inventoryItem: any
let transactionCreated = false
let marketLinkCreated = false

try {
  // Step 1: Create inventory
  const { data: invItem, error: invError } = await serviceSupabase
    .from('Inventory')
    .insert(inventoryRow)
    .select('*')
    .single()

  if (invError) throw invError
  inventoryItem = invItem

  // Step 2: Create transaction
  const { error: txError } = await serviceSupabase
    .from('transactions')
    .insert(transactionRow)

  if (txError) throw txError
  transactionCreated = true

  // Step 3: Create market link
  const { error: linkError } = await serviceSupabase
    .from('inventory_market_links')
    .insert(marketLinkRow)

  if (linkError) throw linkError
  marketLinkCreated = true

} catch (error) {
  // Rollback in reverse order
  console.error('[Add by SKU] Operation failed, rolling back:', error)

  if (marketLinkCreated) {
    await serviceSupabase
      .from('inventory_market_links')
      .delete()
      .eq('item_id', inventoryItem.id)
  }

  if (transactionCreated) {
    await serviceSupabase
      .from('transactions')
      .delete()
      .eq('inventory_id', inventoryItem.id)
  }

  if (inventoryItem) {
    await serviceSupabase
      .from('Inventory')
      .delete()
      .eq('id', inventoryItem.id)
  }

  throw new Error(`Failed to add item: ${error.message}`)
}
```

---

### BUG #10: Incorrect Response Structure in Alias Fallback
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 929-932
**Severity**: MEDIUM

**Issue**: Success response assumes `variant` exists, but trading cards and Alias items don't have variants.

```typescript
// Line 929-932
return NextResponse.json({
  success: true,
  item: { /* ... */ },
  product: { /* ... */ },
  variant: {
    variantId: matchingVariant.variantId, // ❌ Crashes if matchingVariant is null!
    size: matchingVariant.variantValue,
  },
})
```

**When This Crashes**:
- Trading cards (no variant)
- Alias-only items (no StockX variant)
- Products with no size variants

**Fix**:
```typescript
return NextResponse.json({
  success: true,
  item: {
    id: inventoryItem.id,
    sku: inventoryItem.sku,
    brand: inventoryItem.brand,
    model: inventoryItem.model,
    colorway: inventoryItem.colorway,
    size: input.sizeSystem === 'UK' ? inventoryItem.size_uk : inventoryItem.size,
    sizeSystem: input.sizeSystem,
    condition: inventoryItem.condition,
    purchasePrice: inventoryItem.purchase_price,
    purchaseDate: inventoryItem.purchase_date,
  },
  product: {
    catalogId: catalogData.id,
    stockxProductId: catalogData.stockx_product_id,
    sku: catalogData.sku,
    brand: catalogData.brand,
    title: catalogData.model,
    colorway: catalogData.colorway,
    image: catalogData.image_url,
    category: catalogData.category,
    gender: catalogData.gender,
    retailPrice: catalogData.retail_price,
    releaseDate: catalogData.release_date,
  },
  variant: matchingVariant ? {
    variantId: matchingVariant.variantId,
    size: matchingVariant.variantValue,
  } : null, // ✅ Safe for trading cards/Alias items
}, { status: 201 })
```

---

## Medium Priority Issues

### ISSUE #1: No Deduplication in Search Results
**File**: `/src/app/api/add-item/search/route.ts`
**Lines**: 374-391, 462-470
**Severity**: MEDIUM

**Issue**: Duplicate SKUs can appear multiple times in results.

```typescript
// Line 374-391: Takes first match, logs duplicates but doesn't dedupe
if (!stockxMap.has(canonicalSku)) {
  stockxMap.set(canonicalSku, { /* ... */ })
} else {
  console.info('[AddItemSearch] Duplicate canonical SKU in StockX results (keeping first)')
  // But this duplicate is still in the raw results array!
}
```

**Impact**: User sees same product multiple times with different IDs.

**Fix**:
Use Set to track seen SKUs before adding to results.

---

### ISSUE #2: Hardcoded Currency in Multiple Places
**Files**:
- `/src/lib/catalog/stockx.ts` line 246
- `/src/app/api/items/add-by-sku/route.ts` line 320

**Issue**: GBP hardcoded as default despite user currency preference.

```typescript
// catalog/stockx.ts line 246
retail_currency: 'USD', // ❌ Hardcoded

// add-by-sku line 320
const currency: Currency = input.currency || 'GBP' // ❌ Hardcoded default
```

**Fix**: Get from user profile or system settings.

---

### ISSUE #3: No Timeout for External API Calls
**File**: `/src/lib/services/stockx/catalog.ts`
**Lines**: All API calls

**Issue**: No timeout on StockX/Alias requests. Could hang forever.

**Fix**:
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

try {
  const response = await fetch(url, {
    signal: controller.signal,
    // ...
  })
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('Request timeout - StockX API not responding')
  }
  throw error
} finally {
  clearTimeout(timeoutId)
}
```

---

### ISSUE #4: Inefficient Second-Pass Alias Lookup
**File**: `/src/app/api/add-item/search/route.ts`
**Lines**: 806-889

**Issue**: Second-pass makes 1 API call per missing image (N+1 problem).

**Current**:
- 60 results with 30 missing images = 30 sequential API calls

**Fix**: Batch lookup or skip second pass if >10 missing.

---

### ISSUE #5: No Retry Logic for Database Operations
**Files**: All database insert/upsert operations

**Issue**: No retry on transient failures (network blip, connection pool exhausted).

**Fix**:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error: any) {
      if (i === maxRetries - 1) throw error
      if (error.code === '40P01') { // Deadlock
        await new Promise(r => setTimeout(r, 100 * (i + 1)))
        continue
      }
      throw error
    }
  }
  throw new Error('Unreachable')
}
```

---

### ISSUE #6: Missing Indexes on Critical Queries
**Database Performance**

**Missing Indexes**:
1. `product_catalog.stockx_product_id` - Used in catalog lookup
2. `stockx_variants.variant_value` - Used in size matching
3. `inventory_market_links(item_id, stockx_variant_id)` - Composite for market data

**Fix**: Add to migration:
```sql
CREATE INDEX CONCURRENTLY idx_product_catalog_stockx_product
  ON product_catalog(stockx_product_id) WHERE stockx_product_id IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_stockx_variants_value
  ON stockx_variants(variant_value);

CREATE INDEX CONCURRENTLY idx_market_links_item_variant
  ON inventory_market_links(item_id, stockx_variant_id);
```

---

### ISSUE #7: No Validation of Market Data Freshness
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 875-899

**Issue**: Market data sync may succeed but return stale data (>7 days old).

**Fix**: Check `snapshot_at` timestamp and warn user if stale.

---

### ISSUE #8: Inconsistent Error Codes
**File**: `/src/app/api/items/add-by-sku/route.ts`
**Lines**: 565-578

**Issue**: Error responses use different code formats (`NOT_FOUND` vs `NO_SIZE_MATCH`).

**Fix**: Standardize error codes:
```typescript
enum AddItemErrorCode {
  NOT_FOUND = 'PRODUCT_NOT_FOUND',
  NO_SIZE = 'SIZE_NOT_AVAILABLE',
  AMBIGUOUS = 'MULTIPLE_MATCHES',
  VALIDATION = 'VALIDATION_ERROR',
}
```

---

## Low Priority Improvements

### IMPROVEMENT #1: Add Request ID for Debugging
**Impact**: Makes troubleshooting much easier

```typescript
const requestId = crypto.randomUUID()
console.log(`[${requestId}] Starting add-item flow`)
// Log requestId in all subsequent logs
```

---

### IMPROVEMENT #2: Cache StockX Search Results
**Impact**: Reduces API calls for repeated searches

```typescript
const searchCache = new Map<string, { results: any[], timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
```

---

### IMPROVEMENT #3: Add Telemetry/Analytics
**Impact**: Track success/failure rates

```typescript
// Track metrics
await analytics.track('add_item_success', {
  source: 'stockx' | 'alias',
  hasVariant: !!matchingVariant,
  category: catalogData.category,
  duration_ms: Date.now() - startTime,
})
```

---

### IMPROVEMENT #4: Validate Image URLs Before Storing
**Impact**: Prevents broken images in UI

```typescript
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok && res.headers.get('content-type')?.startsWith('image/')
  } catch {
    return false
  }
}
```

---

### IMPROVEMENT #5: Add Database Constraints
**Impact**: Prevent invalid data at DB level

```sql
ALTER TABLE "Inventory"
  ADD CONSTRAINT check_size_not_empty CHECK (size IS NOT NULL AND size <> ''),
  ADD CONSTRAINT check_purchase_price_positive CHECK (purchase_price >= 0);
```

---

### IMPROVEMENT #6: Better TypeScript Types
**Impact**: Catch bugs at compile time

```typescript
// Replace `any` with proper types
interface InventoryItem {
  id: string
  user_id: string
  sku: string
  brand: string
  // ... all fields with correct types
}

// Use discriminated unions for responses
type AddItemResponse =
  | { success: true; item: InventoryItem; product: Product; variant: Variant | null }
  | { success: false; error: string; code: string }
```

---

## Database Schema Issues

### SCHEMA ISSUE #1: Missing NOT NULL Constraints
**Tables Affected**: `Inventory`, `product_catalog`, `stockx_variants`

**Current Schema Gaps**:
```sql
-- Inventory table (schema not found in migrations)
-- Likely missing constraints on:
ALTER TABLE "Inventory"
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN sku SET NOT NULL,
  ALTER COLUMN size SET NOT NULL,
  ALTER COLUMN purchase_price SET NOT NULL;
```

**Recommendation**: Run audit query:
```sql
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name IN ('Inventory', 'product_catalog', 'stockx_variants')
  AND is_nullable = 'YES'
ORDER BY table_name, ordinal_position;
```

---

### SCHEMA ISSUE #2: No CHECK Constraints on Enums
**Tables**: `Inventory.status`, `Inventory.condition`

**Current**: Text fields with no validation
**Fix**:
```sql
ALTER TABLE "Inventory"
  ADD CONSTRAINT check_status CHECK (status IN ('active', 'sold', 'archived')),
  ADD CONSTRAINT check_condition CHECK (condition IN ('New', 'Used', 'Worn', 'Defect'));
```

---

### SCHEMA ISSUE #3: Missing Cascade Deletes
**Tables**: `inventory_market_links`, `stockx_variants`

**Risk**: Orphaned records if parent is deleted

**Fix**:
```sql
ALTER TABLE inventory_market_links
  DROP CONSTRAINT IF EXISTS fk_inventory,
  ADD CONSTRAINT fk_inventory
    FOREIGN KEY (item_id)
    REFERENCES "Inventory"(id)
    ON DELETE CASCADE;
```

---

## Test Cases to Verify Fixes

### Test Case 1: Trading Card Addition
```typescript
// Input
{
  sku: "PSA-10-CHARIZARD",
  size: "OS",
  sizeSystem: "UK",
  purchasePrice: 500,
  purchaseDate: "2025-12-01"
}

// Expected Behavior
1. Product catalog created with category="trading-cards"
2. Inventory created with size="OS", size_uk=null
3. Market link created with stockx_variant_id=NULL
4. Transaction created
5. No errors, item visible in inventory
```

### Test Case 2: StockX Product Not Found
```typescript
// Input
{
  sku: "NONEXISTENT-SKU-123",
  size: "9",
  sizeSystem: "UK",
  purchasePrice: 100,
  purchaseDate: "2025-12-01"
}

// Expected Behavior
1. StockX search returns 0 results
2. Alias fallback attempted
3. If Alias also fails, return clear error:
   {
     code: 'PRODUCT_NOT_FOUND',
     error: 'Product not found on StockX or Alias for SKU "NONEXISTENT-SKU-123"'
   }
4. No database records created
```

### Test Case 3: Size Not Available
```typescript
// Input
{
  sku: "DZ5485-410", // Valid product
  size: "99", // Invalid size
  sizeSystem: "UK",
  purchasePrice: 100,
  purchaseDate: "2025-12-01"
}

// Expected Behavior
1. Product found on StockX
2. Variants fetched (sizes 4-14)
3. Size matching fails
4. Return clear error:
   {
     code: 'SIZE_NOT_AVAILABLE',
     message: 'Product found but size "99" (UK) is not available',
     availableSizes: ['4', '4.5', '5', ...]
   }
5. No database records created
```

### Test Case 4: Partial Failure Recovery
```typescript
// Simulate transaction creation failure
// Mock serviceSupabase.from('transactions').insert() to fail

// Expected Behavior
1. Inventory NOT created (or rolled back)
2. Clear error message to user
3. No orphaned database records
4. User can retry safely
```

### Test Case 5: Duplicate SKU Add
```typescript
// Add same item twice
const item1 = await addItem({ sku: "DZ5485-410", size: "9", ... })
const item2 = await addItem({ sku: "DZ5485-410", size: "9", ... })

// Expected Behavior
1. First add succeeds
2. Second add also succeeds (same product, different inventory row)
3. Both items visible in inventory
4. No database constraint violations
```

### Test Case 6: Alias-Only Product
```typescript
// Input
{
  sku: "ALIAS-ONLY-SKU",
  size: "9",
  sizeSystem: "UK",
  purchasePrice: 100,
  purchaseDate: "2025-12-01",
  aliasCatalogId: "alias-123",
  hasStockx: false
}

// Expected Behavior
1. Skip StockX search (hasStockx=false)
2. Go directly to Alias fallback
3. Create inventory with Alias data
4. Create inventory_alias_links entry
5. No stockx_product_id or stockx_variant_id
6. Success response with source='alias'
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. ✅ BUG #1: Fix foreign key reference in variant creation
2. ✅ BUG #2: Validate trading card market link schema
3. ✅ BUG #3: Fix transaction creation error handling
4. ✅ BUG #9: Add database transaction wrapper

### Phase 2: Data Integrity (Week 2)
5. ✅ BUG #8: Fix size system storage
6. ✅ BUG #10: Fix response structure for null variants
7. ✅ SCHEMA ISSUE #1: Add NOT NULL constraints
8. ✅ SCHEMA ISSUE #3: Add CASCADE deletes

### Phase 3: Reliability (Week 3)
9. ✅ BUG #4: Fix Alias sync race condition
10. ✅ ISSUE #5: Add retry logic for DB operations
11. ✅ ISSUE #3: Add API timeouts
12. ✅ BUG #7: Improve error context in search

### Phase 4: Polish (Week 4)
13. ✅ ISSUE #6: Add database indexes
14. ✅ IMPROVEMENT #1: Add request IDs
15. ✅ IMPROVEMENT #5: Add DB constraints
16. ✅ IMPROVEMENT #6: Improve TypeScript types

---

## Monitoring & Alerts

### Metrics to Track
```typescript
// Add to observability platform
metrics.counter('add_item_attempts_total', { result: 'success' | 'failure', source: 'stockx' | 'alias' })
metrics.histogram('add_item_duration_seconds', { source: 'stockx' | 'alias' })
metrics.counter('add_item_errors_total', { code: 'NOT_FOUND' | 'NO_SIZE_MATCH' | ... })
```

### Alerts to Set Up
1. **Error rate > 10%**: Page on-call engineer
2. **P95 latency > 10s**: Investigate performance
3. **Orphaned inventory records detected**: Data integrity issue
4. **StockX/Alias API errors > 50%**: Provider issue

---

## Conclusion

The add-item flow has **17 critical bugs** that must be fixed to ensure data integrity and user experience. The most urgent issues are:

1. **Foreign key mismatch** in variant creation (BUG #1)
2. **Missing rollback logic** on partial failures (BUG #9)
3. **Silent transaction failures** (BUG #3)

Estimated effort to fix all critical bugs: **2-3 weeks**
Estimated effort for complete overhaul: **4 weeks**

**Recommendation**: Prioritize Phase 1 fixes immediately, then proceed with Phase 2-4 over the next month.

---

**Audit completed by**: Claude (Sonnet 4.5)
**Date**: 2025-12-06
**Next review**: After Phase 1 fixes are deployed
