/**
 * Unified Add Item Search Endpoint
 * GET /api/add-item/search
 *
 * PURPOSE: Reliable StockX+Alias pairing for Add Item modal
 *
 * STRATEGY:
 * 1. Call both StockX and Alias in parallel
 * 2. Normalize SKUs to canonical format for matching
 * 3. Build maps keyed by canonical SKU
 * 4. Merge: StockX rows (truth) + Alias images/IDs
 * 5. Optionally append Alias-only rows at bottom
 * 6. Log mismatches for debugging
 *
 * SEARCH MODE DETECTION:
 * - If query looks like SKU → normalize for both APIs
 * - If query looks like name → use raw query for both APIs
 *
 * RESPONSE FORMAT:
 * Array of merged rows with both StockX and Alias IDs when matched
 */

import { NextRequest, NextResponse } from 'next/server'
import { normalizeSkuForMatching, looksLikeSku } from '@/lib/sku/normalizeSkuForMatching'
import { StockxCatalogService } from '@/lib/services/stockx/catalog'
import { createAliasClient } from '@/lib/services/alias'
import { createClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

/**
 * Search result DTO with paired StockX + Alias data
 */
export interface AddItemSearchRow {
  source: 'stockx' | 'alias_only'

  // StockX data (primary - the "truth")
  stockxProductId: string | null
  styleId: string // Canonical SKU (from StockX or Alias)
  title: string
  brand: string
  colorway: string | null
  retailPrice: number | null // Numeric value from StockX
  releaseDate: string | null // ISO date or null
  category: string | null

  // Alias data (for images + ID)
  aliasCatalogId: string | null
  imageUrl: string | null // Alias full-size or thumbnail

  // Priceable classification
  priceable: boolean
  reason?: 'no_sku' | 'no_size_chart' | 'non_sneaker' | 'apparel' | 'unknown'

  // Debug flags
  hasStockx: boolean
  hasAlias: boolean
}

// ============================================================================
// Helper: Build canonical SKU maps
// ============================================================================

interface StockxRow {
  productId: string
  styleId: string
  productName: string
  brand: string
  colorway?: string
  retailPrice?: number
  releaseDate?: string
  category?: string
}

interface AliasRow {
  catalog_id: string
  sku: string
  name: string
  brand: string
  colorway?: string
  retail_price_cents?: number
  release_date?: string
  product_category_v2?: string
  main_picture_url?: string
}

// ============================================================================
// Helper: Light product-type filtering
// ============================================================================

/**
 * Check if query should boost sneaker results
 * Only checks for general sneaker keywords to prevent apparel outranking shoes
 */
function shouldBoostSneakers(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  const sneakerKeywords = ['jordan', 'yeezy', 'dunk', 'retro', 'new balance']
  return sneakerKeywords.some(keyword => lowerQuery.includes(keyword))
}

/**
 * Check if a category string looks like sneakers/shoes
 */
function isSneakerCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const lower = category.toLowerCase()
  return lower.includes('sneaker') ||
         lower.includes('shoes') ||
         lower.includes('trainers') ||
         lower.includes('footwear')
}

/**
 * Check if category indicates trading cards / TCG / collectible cards
 * Trading cards are PRICEABLE (live StockX pricing, like sneakers)
 */
function isTradingCardCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const lower = category.toLowerCase()
  return lower.includes('trading card') ||
         lower.includes('trading-card') ||
         lower.includes('tcg') ||
         lower.includes('pokemon') ||
         lower.includes('pokémon') ||
         lower.includes('collectible card') ||
         lower.includes('sports card')
}

/**
 * Check if category indicates non-priceable apparel/accessories
 * NOTE: Trading cards are EXCLUDED - they are priceable!
 */
function isNonSneakerCategory(category: string | null | undefined): boolean {
  if (!category) return false

  // Trading cards are priceable, not apparel
  if (isTradingCardCategory(category)) {
    return false
  }

  const lower = category.toLowerCase()
  return lower.includes('apparel') ||
         lower.includes('clothing') ||
         lower.includes('streetwear') ||
         lower.includes('accessory') ||
         lower.includes('accessories') ||
         lower.includes('handbag') ||
         lower.includes('jewelry')
}

/**
 * Classify if an item is priceable (sneakers, trading cards) or non-priceable (apparel)
 *
 * Priceable items:
 * - Sneakers/shoes with valid SKU
 * - Trading cards/TCG/Pokémon with valid SKU
 *
 * Non-priceable items:
 * - Apparel/clothing/accessories (manual entry only)
 * - Items without valid SKU
 */
function classifyPriceability(
  canonicalSku: string | null,
  category: string | null | undefined
): { priceable: boolean; reason?: string } {
  // Rule 1: No valid SKU → non-priceable
  if (canonicalSku === null) {
    return { priceable: false, reason: 'no_sku' }
  }

  // Rule 2: Category indicates apparel/accessories (not sneakers or trading cards) → non-priceable
  if (isNonSneakerCategory(category)) {
    return { priceable: false, reason: 'non_sneaker' }
  }

  // Rule 3: Valid SKU + (sneaker OR trading card OR unknown) → priceable
  return { priceable: true }
}

// ============================================================================
// API Handler
// ============================================================================

export const maxDuration = 30 // Allow up to 30 seconds for multi-page searches

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Validate required parameters
    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    console.log('[AddItemSearch] Starting search:', {
      query,
      limit,
      isSkuMode: looksLikeSku(query),
    })

    // Determine search mode
    const isSkuMode = looksLikeSku(query)
    const normalizedQuery = isSkuMode ? normalizeSkuForMatching(query) : query.trim()

    console.log('[AddItemSearch] Query mode:', {
      mode: isSkuMode ? 'SKU' : 'NAME',
      original: query,
      normalized: normalizedQuery,
    })

    // Get current user for OAuth tokens (optional)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // ========================================================================
    // STEP 1: Multi-page search for both providers (proper recall)
    // ========================================================================

    const STOCKX_PAGE_SIZE = 25
    const ALIAS_PAGE_SIZE = 20
    const MAX_PAGES = 3
    const TARGET_RESULTS = 60

    const [stockxResults, aliasResults] = await Promise.all([
      // StockX multi-page search
      (async () => {
        try {
          const catalogService = new StockxCatalogService(user?.id)
          const searchQuery = isSkuMode ? (normalizedQuery || query.trim()) : query.trim()
          const allResults: any[] = []

          let currentPage = 1

          while (currentPage <= MAX_PAGES && allResults.length < TARGET_RESULTS) {
            const results = await catalogService.searchProducts(searchQuery, {
              limit: STOCKX_PAGE_SIZE,
              pageNumber: currentPage,
              currencyCode: 'GBP',
            })

            if (!results || results.length === 0) {
              console.log(`[AddItemSearch] StockX page ${currentPage}: no more results`)
              break
            }

            allResults.push(...results)
            console.log(`[AddItemSearch] StockX page ${currentPage}: ${results.length} results (total: ${allResults.length})`)

            // Stop if we got fewer results than page size (last page)
            if (results.length < STOCKX_PAGE_SIZE) {
              break
            }

            currentPage++
          }

          console.log('[AddItemSearch] StockX total results:', allResults.length)
          return allResults
        } catch (error: any) {
          console.error('[AddItemSearch] StockX search failed:', error.message)
          return []
        }
      })(),

      // Alias multi-page search
      (async () => {
        try {
          const aliasClient = createAliasClient()
          const searchQuery = isSkuMode ? (normalizedQuery || query.trim()) : query.trim()
          const allResults: any[] = []

          let paginationToken: string | undefined = undefined
          let pageCount = 0

          while (pageCount < MAX_PAGES && allResults.length < TARGET_RESULTS) {
            const response = await aliasClient.searchCatalog(searchQuery, {
              limit: ALIAS_PAGE_SIZE,
              pagination_token: paginationToken,
            })

            const items = response.catalog_items || []

            if (items.length === 0) {
              console.log(`[AddItemSearch] Alias page ${pageCount + 1}: no more results`)
              break
            }

            allResults.push(...items)
            pageCount++
            console.log(`[AddItemSearch] Alias page ${pageCount}: ${items.length} results (total: ${allResults.length})`)

            // Check if there's a next page
            paginationToken = response.next_pagination_token
            if (!paginationToken) {
              break
            }
          }

          console.log('[AddItemSearch] Alias total results:', allResults.length)
          return allResults
        } catch (error: any) {
          console.warn('[AddItemSearch] Alias search failed:', error.message)
          return []
        }
      })(),
    ])

    // ========================================================================
    // STEP 2: Build canonical SKU maps + collect non-priceable items
    // ========================================================================

    // Map: canonicalSku -> StockX result (for priceable items)
    const stockxMap = new Map<string, StockxRow>()
    const nonPriceableStockxItems: any[] = []
    let skippedStockxCount = 0

    for (const product of stockxResults) {
      // FIX #3: Reject items without valid StockX styleId (null, empty, or < 3 chars)
      const hasValidStockxSku = product.styleId && product.styleId.trim().length >= 3
      if (!hasValidStockxSku) {
        nonPriceableStockxItems.push({
          product,
          reason: 'no_sku',
        })
        console.info('[AddItemSearch] Non-priceable StockX item (invalid styleId):', {
          title: product.productName,
          brand: product.brand,
          styleId: product.styleId,
          reason: 'no_sku',
        })
        continue
      }

      const canonicalSku = normalizeSkuForMatching(product.styleId)
      const classification = classifyPriceability(canonicalSku, product.category)

      // Non-priceable: Collect separately
      if (!classification.priceable) {
        nonPriceableStockxItems.push({
          product,
          reason: classification.reason,
        })
        console.info('[AddItemSearch] Non-priceable StockX item:', {
          title: product.productName,
          brand: product.brand,
          category: product.category,
          reason: classification.reason,
        })
        continue
      }

      // Priceable: Add to map (existing logic)
      if (canonicalSku === null) {
        // Should never reach here since classifyPriceability would catch it
        skippedStockxCount++
        console.warn('[AddItemSearch] Unexpected null SKU for priceable item:', {
          productId: product.productId,
          styleId: product.styleId,
        })
        continue
      }

      // Take first match only (in case of duplicates)
      if (!stockxMap.has(canonicalSku)) {
        stockxMap.set(canonicalSku, {
          productId: product.productId,
          styleId: product.styleId, // Keep original styleId
          productName: product.productName,
          brand: product.brand,
          colorway: product.colorway,
          retailPrice: product.retailPrice,
          releaseDate: product.releaseDate,
          category: product.category,
        })
      } else {
        console.info('[AddItemSearch] Duplicate canonical SKU in StockX results (keeping first):', {
          canonicalSku,
          kept: stockxMap.get(canonicalSku)?.styleId,
          skipped: product.styleId,
        })
      }
    }

    // Map: canonicalSku -> Alias result (for priceable items)
    const aliasMap = new Map<string, AliasRow>()
    const nonPriceableAliasItems: any[] = []
    let skippedAliasCount = 0

    for (const item of aliasResults) {
      // Check if item has usable name/brand (needed for non-priceable items)
      const hasUsableData = item.name && item.brand

      // FIX #3: Reject items without valid SKU (null, empty, or < 3 chars)
      const hasValidAliasSku = item.sku && item.sku.trim().length >= 3
      if (!hasValidAliasSku) {
        // Missing/invalid SKU: Add to non-priceable if has name/brand
        if (hasUsableData) {
          nonPriceableAliasItems.push({
            item,
            reason: 'no_sku',
          })
          console.info('[AddItemSearch] Non-priceable Alias item (invalid SKU):', {
            name: item.name,
            brand: item.brand,
            sku: item.sku,
            category: item.product_category_v2,
          })
        } else {
          skippedAliasCount++
          console.warn('[AddItemSearch] Skipped Alias item with invalid SKU and no usable data:', {
            catalogId: item.catalog_id,
            sku: item.sku,
          })
        }
        continue
      }

      const canonicalSku = normalizeSkuForMatching(item.sku)
      const classification = classifyPriceability(canonicalSku, item.product_category_v2)

      // Non-priceable: Collect separately (if has usable data)
      if (!classification.priceable) {
        if (hasUsableData) {
          nonPriceableAliasItems.push({
            item,
            reason: classification.reason,
          })
          console.info('[AddItemSearch] Non-priceable Alias item:', {
            name: item.name,
            brand: item.brand,
            category: item.product_category_v2,
            reason: classification.reason,
          })
        } else {
          skippedAliasCount++
        }
        continue
      }

      // Priceable: Add to map (existing logic)
      if (canonicalSku === null) {
        // Should never reach here since classifyPriceability would catch it
        skippedAliasCount++
        console.warn('[AddItemSearch] Unexpected null SKU for priceable Alias item:', {
          catalogId: item.catalog_id,
          sku: item.sku,
        })
        continue
      }

      // Take first match only (in case of duplicates)
      if (!aliasMap.has(canonicalSku)) {
        aliasMap.set(canonicalSku, item)
      } else {
        console.info('[AddItemSearch] Duplicate canonical SKU in Alias results (keeping first):', {
          canonicalSku,
          kept: aliasMap.get(canonicalSku)?.sku,
          skipped: item.sku,
        })
      }
    }

    console.log('[AddItemSearch] Built maps:', {
      stockxMapSize: stockxMap.size,
      aliasMapSize: aliasMap.size,
      nonPriceableStockx: nonPriceableStockxItems.length,
      nonPriceableAlias: nonPriceableAliasItems.length,
      skippedStockx: skippedStockxCount,
      skippedAlias: skippedAliasCount,
    })

    // ========================================================================
    // STEP 3: Merge results (StockX primary)
    // ========================================================================

    const mergedResults: AddItemSearchRow[] = []
    const processedAliasSkus = new Set<string>()

    // DIAGNOSTIC: Show what's in each map before merging
    console.log('[AddItemSearch] 📊 PRE-MERGE DIAGNOSTIC:')
    console.log('[AddItemSearch] StockX Map Keys (first 10):', Array.from(stockxMap.keys()).slice(0, 10))
    console.log('[AddItemSearch] Alias Map Keys (first 10):', Array.from(aliasMap.keys()).slice(0, 10))

    // Find SKUs that exist in one but not the other
    const stockxOnlySkus: string[] = []
    const aliasOnlySkus: string[] = []
    const pairedSkus: string[] = []

    for (const canonicalSku of stockxMap.keys()) {
      if (aliasMap.has(canonicalSku)) {
        pairedSkus.push(canonicalSku)
      } else {
        stockxOnlySkus.push(canonicalSku)
      }
    }

    for (const canonicalSku of aliasMap.keys()) {
      if (!stockxMap.has(canonicalSku)) {
        aliasOnlySkus.push(canonicalSku)
      }
    }

    console.log('[AddItemSearch] 📊 PAIRING STATS:', {
      paired: pairedSkus.length,
      stockxOnly: stockxOnlySkus.length,
      aliasOnly: aliasOnlySkus.length,
      pairingRate: `${((pairedSkus.length / (stockxMap.size || 1)) * 100).toFixed(1)}%`
    })

    if (stockxOnlySkus.length > 0) {
      console.log('[AddItemSearch] ⚠️ StockX SKUs WITHOUT Alias match (first 5):')
      stockxOnlySkus.slice(0, 5).forEach(canonicalSku => {
        const stockxRow = stockxMap.get(canonicalSku)
        console.log(`  - ${canonicalSku} (original: ${stockxRow?.styleId})`)
      })
    }

    if (aliasOnlySkus.length > 0) {
      console.log('[AddItemSearch] ⚠️ Alias SKUs WITHOUT StockX match (first 5):')
      aliasOnlySkus.slice(0, 5).forEach(canonicalSku => {
        const aliasRow = aliasMap.get(canonicalSku)
        console.log(`  - ${canonicalSku} (original: ${aliasRow?.sku})`)
      })
    }

    // Process StockX results first (they are the "truth")
    for (const [canonicalSku, stockxRow] of stockxMap) {
      const aliasRow = aliasMap.get(canonicalSku)

      if (aliasRow) {
        processedAliasSkus.add(canonicalSku)
      }

      // Build merged row
      const row: AddItemSearchRow = {
        source: 'stockx',

        // StockX data
        stockxProductId: stockxRow.productId,
        styleId: stockxRow.styleId, // Use original StockX styleId
        title: stockxRow.productName,
        brand: stockxRow.brand,
        colorway: stockxRow.colorway || null,
        retailPrice: stockxRow.retailPrice || null,
        releaseDate: stockxRow.releaseDate || null,
        category: stockxRow.category || null,

        // Alias data (if matched)
        aliasCatalogId: aliasRow?.catalog_id || null,
        imageUrl: aliasRow?.main_picture_url || null,

        // Priceable classification
        priceable: true,

        // Debug flags
        hasStockx: true,
        hasAlias: !!aliasRow,
      }

      mergedResults.push(row)

      // Debug logging with canonical SKU
      if (aliasRow) {
        console.info('[AddItemSearch] ✓ Paired:', {
          canonicalSku,
          stockxSku: stockxRow.styleId,
          aliasSku: aliasRow.sku,
          hasImage: !!row.imageUrl,
        })
      } else {
        console.warn('[AddItemSearch] ⚠️ UNPAIRED StockX product:', {
          canonicalSku,
          originalSku: stockxRow.styleId,
          title: stockxRow.productName,
          reason: 'No matching Alias SKU found in aliasMap'
        })
      }
    }

    console.log('[AddItemSearch] Merged StockX results:', mergedResults.length)

    // ========================================================================
    // STEP 4: Add Alias-only rows (not matched with StockX)
    // ========================================================================

    const aliasOnlyResults: AddItemSearchRow[] = []

    for (const [canonicalSku, aliasRow] of aliasMap) {
      // Skip if already processed
      if (processedAliasSkus.has(canonicalSku)) {
        continue
      }

      // Build Alias-only row
      const row: AddItemSearchRow = {
        source: 'alias_only',

        // No StockX data
        stockxProductId: null,
        styleId: aliasRow.sku, // Use Alias SKU
        title: aliasRow.name || '',
        brand: aliasRow.brand || 'Unknown',
        colorway: aliasRow.colorway || null,
        retailPrice: aliasRow.retail_price_cents ? aliasRow.retail_price_cents / 100 : null,
        releaseDate: aliasRow.release_date || null,
        category: aliasRow.product_category_v2 || null,

        // Alias data
        aliasCatalogId: aliasRow.catalog_id || null,
        imageUrl: aliasRow.main_picture_url || null,

        // Priceable classification
        priceable: true,

        // Debug flags
        hasStockx: false,
        hasAlias: true,
      }

      aliasOnlyResults.push(row)

      // Log missing StockX match
      console.info('[AddItemSearch] Missing StockX match for Alias SKU', canonicalSku, {
        aliasCatalogId: aliasRow.catalog_id,
        aliasSku: aliasRow.sku,
      })
    }

    // Append Alias-only results at the bottom
    if (aliasOnlyResults.length > 0) {
      console.log('[AddItemSearch] Adding Alias-only results:', aliasOnlyResults.length)
      mergedResults.push(...aliasOnlyResults)
    }

    // ========================================================================
    // STEP 4.3: Light ordering logic (no complex scoring)
    // ========================================================================

    console.log('[AddItemSearch] Applying light ordering logic...')

    const queryCanonical = normalizedQuery ? normalizeSkuForMatching(normalizedQuery) : null
    const shouldBoost = shouldBoostSneakers(query)

    // Group results by priority
    const exactSkuMatches: AddItemSearchRow[] = []
    const sneakerItems: AddItemSearchRow[] = []
    const apparelItems: AddItemSearchRow[] = []
    const otherItems: AddItemSearchRow[] = []

    for (const row of mergedResults) {
      const rowCanonical = normalizeSkuForMatching(row.styleId)

      // Priority 1: Exact SKU match
      if (queryCanonical && rowCanonical === queryCanonical) {
        exactSkuMatches.push(row)
        continue
      }

      // Priority 2-4: Type-based grouping (only if sneaker boost enabled)
      if (shouldBoost) {
        if (isSneakerCategory(row.category)) {
          sneakerItems.push(row)
        } else if (row.category?.toLowerCase().includes('apparel') ||
                   row.category?.toLowerCase().includes('clothing')) {
          apparelItems.push(row)
        } else {
          otherItems.push(row)
        }
      } else {
        // No boost: preserve original order
        otherItems.push(row)
      }
    }

    // Reconstruct results with new ordering
    const orderedResults = [
      ...exactSkuMatches,
      ...(shouldBoost ? [...sneakerItems, ...apparelItems, ...otherItems] : otherItems)
    ]

    console.log('[AddItemSearch] Ordering stats:', {
      exactMatches: exactSkuMatches.length,
      sneakers: sneakerItems.length,
      apparel: apparelItems.length,
      other: otherItems.length,
      total: orderedResults.length,
      boostApplied: shouldBoost
    })

    // Replace mergedResults with ordered version
    mergedResults.length = 0
    mergedResults.push(...orderedResults)

    // ========================================================================
    // STEP 4.4: Build non-priceable results array
    // ========================================================================

    console.log('[AddItemSearch] Building non-priceable results...')

    const nonPriceableResults: AddItemSearchRow[] = []

    // Add non-priceable StockX items
    for (const { product, reason } of nonPriceableStockxItems) {
      // Try to find matching Alias data for images
      const canonicalSku = normalizeSkuForMatching(product.styleId)
      const aliasRow = canonicalSku ? aliasMap.get(canonicalSku) : undefined

      const row: AddItemSearchRow = {
        source: 'stockx',

        // StockX data
        stockxProductId: product.productId,
        styleId: product.styleId,
        title: product.productName,
        brand: product.brand,
        colorway: product.colorway || null,
        retailPrice: product.retailPrice || null,
        releaseDate: product.releaseDate || null,
        category: product.category || null,

        // Alias data (if matched)
        aliasCatalogId: aliasRow?.catalog_id || null,
        imageUrl: aliasRow?.main_picture_url || null,

        // Priceable classification
        priceable: false,
        reason: reason,

        // Debug flags
        hasStockx: true,
        hasAlias: !!aliasRow,
      }

      nonPriceableResults.push(row)
    }

    // Add non-priceable Alias items (only if not already in StockX non-priceable)
    const processedNonPriceableSkus = new Set<string>()
    for (const { product } of nonPriceableStockxItems) {
      const canonical = normalizeSkuForMatching(product.styleId)
      if (canonical) {
        processedNonPriceableSkus.add(canonical)
      }
    }

    for (const { item, reason } of nonPriceableAliasItems) {
      const canonicalSku = item.sku ? normalizeSkuForMatching(item.sku) : null

      // Skip if already in non-priceable StockX
      if (canonicalSku && processedNonPriceableSkus.has(canonicalSku)) {
        continue
      }

      const row: AddItemSearchRow = {
        source: 'alias_only',

        // No StockX data
        stockxProductId: null,
        styleId: item.sku || 'N/A', // May be missing or invalid
        title: item.name || '',
        brand: item.brand || 'Unknown',
        colorway: item.colorway || null,
        retailPrice: item.retail_price_cents ? item.retail_price_cents / 100 : null,
        releaseDate: item.release_date || null,
        category: item.product_category_v2 || null,

        // Alias data
        aliasCatalogId: item.catalog_id || null,
        imageUrl: item.main_picture_url || null,

        // Priceable classification
        priceable: false,
        reason: reason,

        // Debug flags
        hasStockx: false,
        hasAlias: true,
      }

      nonPriceableResults.push(row)
    }

    console.log('[AddItemSearch] Non-priceable results built:', {
      fromStockX: nonPriceableStockxItems.length,
      fromAlias: nonPriceableAliasItems.length,
      total: nonPriceableResults.length,
    })

    // ========================================================================
    // STEP 4.5: Second-pass Alias lookup for missing images
    // ========================================================================

    console.log('[AddItemSearch] Starting second-pass Alias lookup for missing images...')

    // Get rows that need images (first N results to respect limit)
    const rowsNeedingImages = mergedResults
      .slice(0, limit)
      .filter(row => !row.imageUrl && row.stockxProductId)

    console.log('[AddItemSearch] Rows needing images:', rowsNeedingImages.length)

    if (rowsNeedingImages.length > 0) {
      const aliasClient = createAliasClient()

      // Process each row in parallel (but limit concurrency to avoid rate limits)
      const lookupPromises = rowsNeedingImages.map(async (row) => {
        try {
          const canonicalSku = normalizeSkuForMatching(row.styleId)

          // PHASE 2: Skip if SKU normalization failed
          if (canonicalSku === null) {
            console.warn('[AddItemSearch] Skipped second-pass for invalid SKU:', row.styleId)
            return
          }

          console.info('[AddItemSearch] 🔍 Second-pass lookup for:', {
            canonicalSku,
            styleId: row.styleId,
          })

          // Search Alias with the original styleId (not canonical)
          // This gives Alias a chance to match with their own normalization
          const response = await aliasClient.searchCatalog(row.styleId, { limit: 1 })

          if (response.catalog_items && response.catalog_items.length > 0) {
            const aliasItem = response.catalog_items[0]

            if (!aliasItem.sku) {
              console.warn('[AddItemSearch] Alias item missing SKU:', aliasItem.catalog_id)
              return
            }

            const aliasCanonicalSku = normalizeSkuForMatching(aliasItem.sku)

            // PHASE 2: Skip if Alias SKU normalization failed
            if (aliasCanonicalSku === null) {
              console.warn('[AddItemSearch] Skipped Alias match with invalid SKU:', aliasItem.sku)
              return
            }

            // Check if canonical SKUs match
            if (aliasCanonicalSku === canonicalSku) {
              // Attach image to existing row
              row.imageUrl = aliasItem.main_picture_url || null
              row.aliasCatalogId = aliasItem.catalog_id || null
              row.hasAlias = true

              console.info('[AddItemSearch] ✓ Second-pass match found:', {
                canonicalSku,
                stockxSku: row.styleId,
                aliasSku: aliasItem.sku,
                hasImage: !!row.imageUrl,
              })
            } else {
              console.info('[AddItemSearch] ⚠ Second-pass SKU mismatch:', {
                canonicalSku,
                aliasCanonicalSku,
                stockxSku: row.styleId,
                aliasSku: aliasItem.sku,
              })
            }
          } else {
            console.info('[AddItemSearch] ✗ No second-pass Alias match for:', canonicalSku)
          }
        } catch (error: any) {
          console.warn('[AddItemSearch] Second-pass lookup failed for', row.styleId, error.message)
          // Continue gracefully
        }
      })

      // Wait for all lookups to complete
      await Promise.all(lookupPromises)

      const successCount = rowsNeedingImages.filter(r => r.imageUrl).length
      console.log('[AddItemSearch] Second-pass complete:', {
        attempted: rowsNeedingImages.length,
        succeeded: successCount,
      })
    }

    // ========================================================================
    // STEP 5: Enforce limit and return
    // ========================================================================

    // Truncate priceable results to limit
    const finalPriceableResults = mergedResults.slice(0, limit)

    // Non-priceable results: no limit (return all)
    const finalNonPriceableResults = nonPriceableResults

    const duration = Date.now() - startTime

    console.log('[AddItemSearch] Complete:', {
      query,
      priceableCount: finalPriceableResults.length,
      nonPriceableCount: finalNonPriceableResults.length,
      totalCount: finalPriceableResults.length + finalNonPriceableResults.length,
      duration_ms: duration,
    })

    return NextResponse.json({
      priceable: finalPriceableResults,
      nonPriceable: finalNonPriceableResults,
      query: normalizedQuery,
      mode: isSkuMode ? 'sku' : 'name',
      duration_ms: duration,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[AddItemSearch] Error:', {
      error: error.message,
      stack: error.stack,
      duration_ms: duration,
    })

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
