/**
 * eBay Ingestion Mapper
 * Transforms eBay Browse API search results → master_market_data table rows
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 1 - MINIMAL IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SCOPE:
 * - NEW condition only (conditionId: 1000)
 * - AUTHENTICITY_GUARANTEE only
 * - Sneakers only (categories: 15709, 95672, 155194)
 * - Browse API only (item_summary/search endpoint)
 *
 * WHAT WE MAP:
 * - provider: 'ebay'
 * - sku: Extracted from title via regex (fallback to search query)
 * - size_key: Extracted from title via regex (fallback to 'ALL')
 * - last_sale_price: item.price (for sold items)
 * - lowest_ask: item.price (for active listings)
 * - currency_code: item.currency
 *
 * WHAT WE LEAVE NULL:
 * - highest_bid: Browse API doesn't provide bid data
 * - sales_last_72h/30d: Browse API doesn't provide volume breakdowns
 * - average_deadstock_price: StockX-specific
 * - volatility: StockX-specific
 * - global_indicator_price: Alias-specific
 * - raw_snapshot_id: Phase 2 (no ebay_raw_snapshots table yet)
 *
 * KNOWN LIMITATIONS:
 * 1. SKU extraction is best-effort regex (may not match all formats)
 * 2. Size extraction is best-effort regex (may not catch all variations)
 * 3. soldAt timestamp is itemEndDate (proxy, not exact sold date)
 * 4. No shipping/fees data
 * 5. Single marketplace only (EBAY_GB hardcoded in client)
 *
 * AGGREGATION STRATEGY:
 * - If multiple items have same (sku, size_key):
 *   → Take LOWEST price (most competitive)
 *   → Single row per (provider, sku, size_key, currency_code)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import { EbaySoldItem } from '../ebay/types'
import { enrichEbaySoldItem } from '../ebay/extractors'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface IngestionOptions {
  searchQuery: string // Fallback SKU if extraction fails
  currencyCode: string // Filter to specific currency
  soldItemsOnly: boolean // true = last_sale_price, false = lowest_ask
}

interface AggregatedItem {
  sku: string
  sizeKey: string
  sizeNumeric: number | null
  price: number
  itemId: string
  title: string
  soldAt: string
}

// ============================================================================
// SKU EXTRACTION
// ============================================================================

/**
 * Extract SKU from eBay listing title
 *
 * Patterns we match:
 * - Nike/Jordan: DD1391-100, DZ5485-410, CW2288-111
 * - Adidas: GX3724, GW0265
 * - New Balance: M990GL6, ML574EVE
 *
 * Examples:
 *   "Nike Air Jordan 4 Retro Black Cat 2020 DD1391-100 Size 10.5"
 *   → "DD1391-100"
 *
 *   "Air Jordan 4 Black Cat (DD1391-100) Men's Size 11"
 *   → "DD1391-100"
 *
 *   "Yeezy Boost 350 V2 Zebra Size UK 9"
 *   → null (no SKU pattern found)
 */
function extractSku(title: string): string | null {
  // Pattern 1: Nike/Jordan style codes (XX(X)XXXX-XXX)
  const nikePattern = /\b([A-Z]{2,3}\d{4}-\d{3})\b/i
  const nikeMatch = title.match(nikePattern)
  if (nikeMatch) {
    return nikeMatch[1].toUpperCase()
  }

  // Pattern 2: Adidas style codes (XXXXXX, all caps/digits)
  const adidasPattern = /\b([A-Z]{2}\d{4})\b/
  const adidasMatch = title.match(adidasPattern)
  if (adidasMatch) {
    return adidasMatch[1].toUpperCase()
  }

  // Pattern 3: New Balance (MXXXXX or similar)
  const nbPattern = /\b(M[A-Z0-9]{5,6})\b/i
  const nbMatch = title.match(nbPattern)
  if (nbMatch) {
    return nbMatch[1].toUpperCase()
  }

  // No match
  return null
}

/**
 * Extract size from eBay listing title
 *
 * Patterns we match:
 * - "Size 10.5"
 * - "Size: 10.5"
 * - "Size: US 10.5"
 * - "UK 9"
 * - "EU 44"
 * - "Men's 10.5"
 * - "US Men's 10.5"
 *
 * Returns: { key: "10.5", system: "US" } or { key: "UK 9", system: "UK" }
 */
function extractSize(title: string): { key: string; system: string } | null {
  // Pattern 1: "Size: US 10.5" or "Size 10.5"
  const sizePattern1 = /Size:?\s*(?:US\s*)?(\d+(?:\.\d+)?)/i
  const match1 = title.match(sizePattern1)
  if (match1) {
    return { key: match1[1], system: 'US' }
  }

  // Pattern 2: "UK 9" or "UK9"
  const ukPattern = /\bUK\s*(\d+(?:\.\d+)?)\b/i
  const ukMatch = title.match(ukPattern)
  if (ukMatch) {
    return { key: `UK ${ukMatch[1]}`, system: 'UK' }
  }

  // Pattern 3: "EU 44"
  const euPattern = /\bEU\s*(\d+(?:\.\d+)?)\b/i
  const euMatch = title.match(euPattern)
  if (euMatch) {
    return { key: `EU ${euMatch[1]}`, system: 'EU' }
  }

  // Pattern 4: "Men's 10.5" or "Mens 10.5"
  const mensPattern = /\bMen'?s\s*(\d+(?:\.\d+)?)\b/i
  const mensMatch = title.match(mensPattern)
  if (mensMatch) {
    return { key: mensMatch[1], system: 'US' }
  }

  // Pattern 5: Just a number followed by common size indicators
  const genericPattern = /\b(\d+(?:\.\d+)?)\s*(?:US|M|W)?\b/i
  const genericMatch = title.match(genericPattern)
  if (genericMatch) {
    return { key: genericMatch[1], system: 'US' }
  }

  // No size found
  return null
}

/**
 * Parse numeric size from size key for sorting/matching
 * Same logic as StockX mapper
 */
function parseSizeNumeric(sizeKey: string): number | null {
  // Remove non-numeric characters except decimal point
  const cleaned = sizeKey.replace(/[^0-9.]/g, '')

  if (!cleaned) {
    return null
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

// ============================================================================
// AGGREGATION
// ============================================================================

/**
 * Aggregate multiple eBay items into unique (sku, size) combinations
 *
 * Strategy:
 * - Enrich each item with extracted data (SKU, size, shipping)
 * - Group by (sku, size_key)
 * - Take LOWEST price for each group (most competitive)
 * - Preserve itemId and title from lowest-price item
 */
function aggregateItems(
  items: EbaySoldItem[],
  searchQuery: string
): AggregatedItem[] {
  const groups = new Map<string, AggregatedItem>()

  for (const item of items) {
    // Enrich item with extracted data (SKU from title/variations, size from variations/title)
    enrichEbaySoldItem(item)

    // EXCLUSION: Skip items with LOW confidence size system detection
    // These will not be included in Smart Archived Price calculations
    if (item.sizeInfo && item.sizeInfo.confidence === 'LOW') {
      console.warn('[eBay Mapper] Excluding LOW confidence size', {
        itemId: item.itemId,
        title: item.title,
        sizeInfo: item.sizeInfo,
        reason: 'Size system cannot be determined with confidence (excluded from included_in_metrics)',
      })
      continue // Skip this item
    }

    // Use extracted SKU (fallback to search query if extraction failed)
    const sku = item.extractedSKU || searchQuery

    // Use extracted size (fallback to 'ALL' if no size found)
    const sizeKey = item.extractedSize || 'ALL'
    const sizeNumeric = parseSizeNumeric(sizeKey)

    // Group key: sku + size_key
    const groupKey = `${sku}|${sizeKey}`

    // Check if we already have this group
    const existing = groups.get(groupKey)

    if (!existing || item.price < existing.price) {
      // New group or lower price - update
      groups.set(groupKey, {
        sku,
        sizeKey,
        sizeNumeric,
        price: item.price,
        itemId: item.itemId,
        title: item.title,
        soldAt: item.soldAt,
      })
    }
  }

  return Array.from(groups.values())
}

// ============================================================================
// INGESTION FUNCTION
// ============================================================================

/**
 * Ingest eBay Browse API search results into master_market_data
 *
 * @param items - Array of eBay items from Browse API
 * @param options - Context for normalization
 */
export async function ingestEbayBrowseSearchResults(
  items: EbaySoldItem[],
  options: IngestionOptions
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchQuery, currencyCode, soldItemsOnly } = options

  // Filter by currency
  const matchingItems = items.filter((item) => item.currency === currencyCode)

  if (matchingItems.length === 0) {
    console.log('[eBay Mapper] No items matching currency', {
      searchQuery,
      currencyCode,
      totalItems: items.length,
    })
    return
  }

  // Aggregate to unique (sku, size) combinations
  const aggregated = aggregateItems(matchingItems, searchQuery)

  console.log('[eBay Mapper] Aggregated items', {
    searchQuery,
    currencyCode,
    totalItems: matchingItems.length,
    uniqueSkuSize: aggregated.length,
  })

  // Build master_market_data rows
  const rows = aggregated.map((item) => {
    // Determine size_system from the enriched data
    // Note: We've already filtered out LOW confidence sizes in aggregation
    let sizeSystem = 'US' // Default

    // Try to infer from sizeKey format
    if (item.sizeKey.startsWith('US ')) {
      sizeSystem = 'US'
    } else if (item.sizeKey.startsWith('UK ')) {
      sizeSystem = 'UK'
    } else if (item.sizeKey.startsWith('EU ')) {
      sizeSystem = 'EU'
    }

    return {
      // Provider identification
      provider: 'ebay',
      provider_source: 'ebay_browse_search',
      provider_product_id: null, // Browse API doesn't provide product ID
      provider_variant_id: item.itemId,

      // Normalized identifiers
      sku: item.sku,
      size_key: item.sizeKey,
      size_numeric: item.sizeNumeric,
      size_system: sizeSystem, // Extracted from size_key prefix

      // Currency context
      currency_code: currencyCode,
      region_code: null, // TODO: infer from marketplace (EBAY_GB → 'GB')

      // Pricing data
      // If soldItemsOnly=true: this is last_sale_price
      // If soldItemsOnly=false: this is lowest_ask
      lowest_ask: soldItemsOnly ? null : item.price,
      last_sale_price: soldItemsOnly ? item.price : null,
      highest_bid: null, // Browse API doesn't provide bid data

      // Volume indicators (not available in Browse API)
      sales_last_72h: null,
      sales_last_30d: null, // TODO: Could count items in aggregation?
      total_sales_volume: null,
      ask_count: null,
      bid_count: null,

      // Provider-specific fields (not applicable)
      average_deadstock_price: null,
      volatility: null,
      price_premium: null,
      global_indicator_price: null,

      // Metadata
      snapshot_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      raw_snapshot_id: null, // TODO: Phase 2 - add ebay_raw_snapshots table
      raw_snapshot_provider: null,
      raw_response_excerpt: {
        itemId: item.itemId,
        title: item.title,
        soldAt: item.soldAt,
      },
    }
  })

  // Upsert into master_market_data
  // Will use the table's unique constraint (idx_master_market_unique_snapshot)
  const { error } = await supabase.from('master_market_data').upsert(rows)

  if (error) {
    console.error('[eBay Mapper] Failed to upsert market data:', {
      error,
      searchQuery,
      currencyCode,
      rowCount: rows.length,
    })
    // Don't throw - graceful degradation
  } else {
    console.log('[eBay Mapper] Successfully upserted:', {
      searchQuery,
      currencyCode,
      rowCount: rows.length,
      soldItemsOnly,
    })
  }
}
