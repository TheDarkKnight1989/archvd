/**
 * ARCHVD Inventory V4 - Unified Search
 *
 * Fresh V4 implementation for searching products across:
 * - Local database (inventory_v4_style_catalog)
 * - StockX API
 * - Alias API
 *
 * Features:
 * - Input type detection (SKU, search query, StockX URL, Alias URL)
 * - Parallel search across all sources
 * - Merge and dedupe by SKU (local wins, then stockx > alias)
 * - Returns unified SearchResultV4 objects
 *
 * IMPORTANT: This file is SERVER-ONLY. It uses SUPABASE_SERVICE_ROLE_KEY.
 * Never import this into client-side code.
 */

import 'server-only'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getCatalogService } from '@/lib/services/stockx/catalog'
import { createAliasClient } from '@/lib/services/alias/client'
import type { SearchResultV4, SearchResponseV4 } from './types'
// Import pure utilities from shared module (DRY - single source of truth)
import {
  detectInputType,
  extractStockXSlug,
  extractAliasCatalogId,
} from './shared'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum query length before hitting external APIs (rate limit protection) */
const MIN_EXTERNAL_QUERY_LENGTH = 3

/** Fields to select from style_catalog (avoid SELECT *) */
const STYLE_CATALOG_FIELDS = [
  'style_id',
  'name',
  'brand',
  'primary_image_url',
  'colorway',
  'stockx_product_id',
  'stockx_url_key',
  'alias_catalog_id',
].join(',')

/** Type for the selected fields (matches STYLE_CATALOG_FIELDS) */
interface StyleCatalogSearchRow {
  style_id: string
  name: string | null
  brand: string | null
  primary_image_url: string | null
  colorway: string | null
  stockx_product_id: string | null
  stockx_url_key: string | null
  alias_catalog_id: string | null
}

// =============================================================================
// SUPABASE SINGLETON
// =============================================================================

let supabaseServiceClient: SupabaseClient | null = null

/**
 * Get or create singleton Supabase service client
 * Reuses connection for performance (search-as-you-type friendly)
 */
function getServiceClient(): SupabaseClient | null {
  if (supabaseServiceClient) return supabaseServiceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[Search V4] Missing Supabase credentials for local search')
    return null
  }

  supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }, // Server context - no session persistence needed
  })
  return supabaseServiceClient
}

// =============================================================================
// SANITIZATION
// =============================================================================

/**
 * Maximum limit for search results (prevents API hammering)
 * NOTE: Route handler should also enforce this limit for consistent UX
 */
const MAX_SEARCH_LIMIT = 25

/**
 * Escape special characters for PostgREST filter syntax.
 * PostgREST uses , ) ( " . : % and other chars in filter strings.
 * This prevents query manipulation via malicious input.
 *
 * Characters removed:
 * - , ( ) " ' \ : ; - PostgREST structural chars
 * - % _ - SQL LIKE wildcards (we add our own % for contains search)
 *
 * NOTE: Hyphen (-) is preserved since it's common in SKUs (DD1391-100)
 */
function sanitizeForPostgrest(input: string): string {
  return input
    .replace(/[,()"\\'.:;%_]/g, '') // Remove filter-breaking chars (hyphen kept for SKUs)
    .trim()
}

/**
 * Clamp limit to safe range
 */
function clampLimit(limit: number): number {
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, limit))
}

// =============================================================================
// INPUT TYPE DETECTION & URL EXTRACTION
// =============================================================================
// NOTE: detectInputType, extractStockXSlug, extractAliasCatalogId are imported
// from ./shared (pure utilities that can run on client or server)

// =============================================================================
// SEARCH SOURCES
// =============================================================================

/**
 * Search local database (inventory_v4_style_catalog)
 */
async function searchLocalDatabase(
  query: string,
  limit: number
): Promise<SearchResultV4[]> {
  const supabase = getServiceClient()
  if (!supabase) return []

  // Sanitize query for PostgREST filter injection prevention
  const sanitizedQuery = sanitizeForPostgrest(query)
  if (!sanitizedQuery) {
    return []
  }

  // Search by style_id OR by name (ilike is case-insensitive)
  const { data, error } = await supabase
    .from('inventory_v4_style_catalog')
    .select(STYLE_CATALOG_FIELDS)
    .or(`style_id.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`)
    .limit(limit)

  if (error) {
    console.error('[Search V4] Local search error:', error)
    return []
  }

  const rows = (data || []) as unknown as StyleCatalogSearchRow[]
  return rows.map((row): SearchResultV4 => ({
    styleId: row.style_id,
    name: row.name || row.style_id,
    brand: row.brand || 'Unknown',
    imageUrl: row.primary_image_url || null,
    colorway: row.colorway || null,
    inDatabase: true,
    source: 'local',
    externalIds: {
      stockxProductId: row.stockx_product_id || undefined,
      stockxUrlKey: row.stockx_url_key || undefined,
      aliasCatalogId: row.alias_catalog_id || undefined,
    },
  }))
}

/**
 * Search StockX API
 */
async function searchStockX(
  query: string,
  limit: number
): Promise<SearchResultV4[]> {
  try {
    const catalogService = getCatalogService()
    const products = await catalogService.searchProducts(query, { limit })

    return products
      .filter((p) => p.styleId) // Must have a SKU
      .map((product): SearchResultV4 => ({
        styleId: product.styleId.toUpperCase(),
        name: product.productName,
        brand: product.brand,
        imageUrl: product.image || null,
        colorway: product.colorway || null,
        inDatabase: false, // Will be updated during merge if found locally
        source: 'stockx',
        externalIds: {
          stockxProductId: product.productId,
        },
      }))
  } catch (error) {
    console.error('[Search V4] StockX search error:', error)
    return []
  }
}

/**
 * Search Alias API
 */
async function searchAlias(
  query: string,
  limit: number
): Promise<SearchResultV4[]> {
  try {
    const aliasClient = createAliasClient()
    const response = await aliasClient.searchCatalog(query, { limit })

    return response.catalog_items
      .filter((item) => item.sku) // Must have a SKU
      .map((item): SearchResultV4 => ({
        styleId: item.sku.toUpperCase(),
        name: item.name,
        brand: item.brand,
        imageUrl: item.main_picture_url || null,
        colorway: item.colorway || null,
        inDatabase: false, // Will be updated during merge if found locally
        source: 'alias',
        externalIds: {
          aliasCatalogId: item.catalog_id,
        },
      }))
  } catch (error) {
    console.error('[Search V4] Alias search error:', error)
    return []
  }
}

/**
 * Resolve Alias catalog ID directly to a product
 * Used when user pastes an Alias URL - we can look up the exact product
 */
async function resolveAliasCatalogId(catalogId: string): Promise<SearchResultV4 | null> {
  try {
    const aliasClient = createAliasClient()
    const response = await aliasClient.getCatalogItem(catalogId)
    const item = response.catalog_item

    if (!item.sku) {
      console.warn('[Search V4] Alias catalog item has no SKU:', catalogId)
      return null
    }

    return {
      styleId: item.sku.toUpperCase(),
      name: item.name,
      brand: item.brand,
      imageUrl: item.main_picture_url || null,
      colorway: item.colorway || null,
      inDatabase: false,
      source: 'alias',
      externalIds: {
        aliasCatalogId: item.catalog_id,
      },
    }
  } catch (error) {
    console.error('[Search V4] Alias catalog lookup error:', error)
    return null
  }
}

// =============================================================================
// IMAGE ENRICHMENT
// =============================================================================

/**
 * Enrich local results that have aliasCatalogId but no image.
 * Fetches image URLs from Alias API in parallel (max 5 concurrent).
 * This ensures local results always have images when possible.
 */
async function enrichResultsWithImages(results: SearchResultV4[]): Promise<SearchResultV4[]> {
  // Find results that need image enrichment
  const needsEnrichment = results.filter(
    r => !r.imageUrl && r.externalIds.aliasCatalogId
  )

  if (needsEnrichment.length === 0) {
    return results
  }

  // Fetch images in parallel (limit concurrency to avoid rate limits)
  const BATCH_SIZE = 5
  const imageMap = new Map<string, string>()

  try {
    const aliasClient = createAliasClient()

    for (let i = 0; i < needsEnrichment.length; i += BATCH_SIZE) {
      const batch = needsEnrichment.slice(i, i + BATCH_SIZE)
      const promises = batch.map(async (result) => {
        const catalogId = result.externalIds.aliasCatalogId!
        try {
          const response = await aliasClient.getCatalogItem(catalogId)
          if (response.catalog_item?.main_picture_url) {
            imageMap.set(result.styleId, response.catalog_item.main_picture_url)
          }
        } catch {
          // Silent fail - image enrichment is best-effort
        }
      })
      await Promise.all(promises)
    }
  } catch {
    // If Alias client fails to initialize, return results as-is
    return results
  }

  // Apply enriched images
  return results.map(result => {
    if (!result.imageUrl && imageMap.has(result.styleId)) {
      return { ...result, imageUrl: imageMap.get(result.styleId)! }
    }
    return result
  })
}

// =============================================================================
// MERGE AND DEDUPE
// =============================================================================

/**
 * Source priority for merge/dedupe (higher = better)
 * NOTE: Priority is for metadata (name, brand). Images always prefer Alias (GOAT CDN).
 */
const SOURCE_PRIORITY: Record<SearchResultV4['source'], number> = {
  local: 3,   // Highest - our database
  alias: 2,   // Second - better images from GOAT CDN
  stockx: 1,  // Third - fallback
}

/**
 * Normalize SKU for comparison/deduplication
 * Handles variations: "DM7866 104" vs "DM7866-104" vs "dm7866104"
 */
function normalizeSku(sku: string): string {
  return sku
    .toUpperCase()
    .replace(/[\s-]/g, '-') // Normalize spaces to hyphens
    .replace(/--+/g, '-')   // Remove double hyphens
    .trim()
}

/**
 * Check if an image URL is from Alias/GOAT (preferred source)
 */
function isAliasImage(url: string | null): boolean {
  if (!url) return false
  return url.includes('image.goat.com') || url.includes('goat.com')
}

/**
 * Merge and deduplicate search results by SKU
 * Priority: local > alias > stockx (explicit, deterministic)
 * External IDs are always merged across sources
 * Images: Always prefer Alias/GOAT images when available
 */
function mergeAndDedupeResults(results: SearchResultV4[]): SearchResultV4[] {
  const byStyleId = new Map<string, SearchResultV4>()

  for (const result of results) {
    const normalizedSku = normalizeSku(result.styleId)
    const existing = byStyleId.get(normalizedSku)

    if (!existing) {
      // First occurrence
      byStyleId.set(normalizedSku, { ...result, styleId: normalizedSku })
      continue
    }

    const existingPriority = SOURCE_PRIORITY[existing.source]
    const resultPriority = SOURCE_PRIORITY[result.source]

    // Merge external IDs from both sources
    const mergedExternalIds = {
      stockxProductId: existing.externalIds.stockxProductId ?? result.externalIds.stockxProductId,
      stockxUrlKey: existing.externalIds.stockxUrlKey ?? result.externalIds.stockxUrlKey,
      aliasCatalogId: existing.externalIds.aliasCatalogId ?? result.externalIds.aliasCatalogId,
    }

    // Always prefer Alias/GOAT images regardless of source priority
    const bestImageUrl = isAliasImage(result.imageUrl) ? result.imageUrl
      : isAliasImage(existing.imageUrl) ? existing.imageUrl
      : existing.imageUrl ?? result.imageUrl

    if (resultPriority > existingPriority) {
      // New result has higher priority - use its data but merge external IDs
      byStyleId.set(normalizedSku, {
        ...result,
        styleId: normalizedSku,
        imageUrl: bestImageUrl,
        externalIds: mergedExternalIds,
      })
    } else {
      // Keep existing data but merge external IDs and fill missing fields
      byStyleId.set(normalizedSku, {
        ...existing,
        imageUrl: bestImageUrl,
        colorway: existing.colorway ?? result.colorway,
        externalIds: mergedExternalIds,
      })
    }
  }

  return [...byStyleId.values()]
}

// =============================================================================
// UNIFIED SEARCH
// =============================================================================

export interface UnifiedSearchOptions {
  limit?: number
  includeExternal?: boolean
  skipLocal?: boolean
  skipStockX?: boolean
  skipAlias?: boolean
}

/**
 * Unified search across all sources
 *
 * @param query - Search query (SKU, product name, or URL)
 * @param options - Search options
 * @returns Unified search response with results from all sources
 */
export async function unifiedSearchV4(
  query: string,
  options: UnifiedSearchOptions = {}
): Promise<SearchResponseV4> {
  const {
    limit: rawLimit = 10,
    includeExternal = true,
    skipLocal = false,
    skipStockX = false,
    skipAlias = false,
  } = options

  // Clamp limit to safe range (1-25) to prevent API hammering
  const limit = clampLimit(rawLimit)

  const startTime = Date.now()
  const inputType = detectInputType(query)
  const timing: SearchResponseV4['timing'] = { total: 0 }

  let searchQuery = query.trim()

  // =========================================================================
  // SPECIAL CASE: Alias URL - resolve directly via getCatalogItem
  // =========================================================================
  if (inputType === 'alias_url') {
    const catalogId = extractAliasCatalogId(query)
    if (catalogId) {
      const aliasStart = Date.now()
      const directResult = await resolveAliasCatalogId(catalogId)
      timing.alias = Date.now() - aliasStart

      if (directResult) {
        // Also search local DB to check if we have this SKU
        const localStart = Date.now()
        const localResults = skipLocal ? [] : await searchLocalDatabase(directResult.styleId, 1)
        timing.local = Date.now() - localStart

        const allResults = [...localResults, directResult]
        const mergedResults = mergeAndDedupeResults(allResults)

        timing.total = Date.now() - startTime
        return {
          results: mergedResults,
          query: catalogId,
          inputType,
          timing,
        }
      }
      // Direct resolve failed, fall through to search
      searchQuery = catalogId
    }
  }

  // =========================================================================
  // SPECIAL CASE: StockX URL - extract slug and search
  // NOTE: Slug is not a SKU, but searching for it should return the product
  // =========================================================================
  if (inputType === 'stockx_url') {
    const slug = extractStockXSlug(query)
    if (slug) searchQuery = slug
  }

  // =========================================================================
  // Check if query is too short for external API calls (rate limit protection)
  // SKUs and URLs bypass this check
  // =========================================================================
  const isSku = inputType === 'sku'
  const isUrl = inputType === 'stockx_url' || inputType === 'alias_url'
  const queryTooShortForExternal = !isSku && !isUrl && searchQuery.length < MIN_EXTERNAL_QUERY_LENGTH

  // Search all sources in parallel
  const searchPromises: Promise<{ source: string; results: SearchResultV4[]; time: number }>[] = []

  if (!skipLocal) {
    searchPromises.push(
      (async () => {
        const localStart = Date.now()
        const results = await searchLocalDatabase(searchQuery, limit)
        return { source: 'local', results, time: Date.now() - localStart }
      })()
    )
  }

  // Only hit external APIs if query is long enough (or is SKU/URL)
  if (includeExternal && !skipStockX && !queryTooShortForExternal) {
    searchPromises.push(
      (async () => {
        const stockxStart = Date.now()
        const results = await searchStockX(searchQuery, limit)
        return { source: 'stockx', results, time: Date.now() - stockxStart }
      })()
    )
  }

  if (includeExternal && !skipAlias && !queryTooShortForExternal) {
    searchPromises.push(
      (async () => {
        const aliasStart = Date.now()
        const results = await searchAlias(searchQuery, limit)
        return { source: 'alias', results, time: Date.now() - aliasStart }
      })()
    )
  }

  // Wait for all searches
  const searchResults = await Promise.all(searchPromises)

  // Collect results and timing
  const allResults: SearchResultV4[] = []

  for (const { source, results, time } of searchResults) {
    allResults.push(...results)
    if (source === 'local') timing.local = time
    if (source === 'stockx') timing.stockx = time
    if (source === 'alias') timing.alias = time
  }

  // Merge and dedupe
  const mergedResults = mergeAndDedupeResults(allResults)

  // Sort: local first, then by name
  mergedResults.sort((a, b) => {
    if (a.inDatabase && !b.inDatabase) return -1
    if (!a.inDatabase && b.inDatabase) return 1
    return a.name.localeCompare(b.name)
  })

  // Limit final results
  const limitedResults = mergedResults.slice(0, limit)

  // Enrich local results with images from Alias (for results missing images)
  // This is the "best-in-class" step - local wins for metadata, Alias wins for images
  const enrichStart = Date.now()
  const finalResults = await enrichResultsWithImages(limitedResults)
  timing.enrich = Date.now() - enrichStart

  timing.total = Date.now() - startTime

  return {
    results: finalResults,
    query: searchQuery,
    inputType,
    timing,
  }
}

