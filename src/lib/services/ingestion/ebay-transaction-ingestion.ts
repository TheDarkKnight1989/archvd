/**
 * eBay Transaction Ingestion
 * Stores individual eBay sold items in ebay_sold_transactions table
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 1 - TIME-SERIES ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE:
 * Transform eBay Browse API results → ebay_sold_transactions rows
 * Store EVERY sale individually (not aggregated)
 *
 * EXCLUSION RULES (via GENERATED included_in_metrics column):
 * - condition_id = '1000' only (not 1500, 1750)
 * - authenticity_guarantee = TRUE
 * - size_key IS NOT NULL
 * - size_system IS NOT NULL (not 'UNKNOWN')
 * - size_confidence = 1.0 (ONLY HIGH - variation-sourced, not title-parsed)
 * - is_outlier = FALSE
 * - exclusion_reason IS NULL
 *
 * CONFIDENCE MAPPING:
 * - HIGH → 1.0 (from eBay variations with explicit "US/UK/EU Shoe Size")
 * - MEDIUM → 0.70 (from title parsing) - EXCLUDED for AG items
 * - LOW → 0.30 (ambiguous) - EXCLUDED for AG items
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import { EbaySoldItem } from '../ebay/types'
import { enrichEbaySoldItem } from '../ebay/extractors'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TransactionIngestionOptions {
  searchQuery: string // For SKU fallback
  marketplaceId?: string // Default: EBAY_GB
  dryRun?: boolean // If true, don't insert, just return rows
}

interface EbayTransactionRow {
  // Provider identification
  ebay_item_id: string
  marketplace_id: string

  // Product identification
  sku: string
  size_key: string | null
  size_numeric: number | null
  size_system: string | null
  size_confidence: number | null

  // Transaction details
  sale_price_cents: number
  currency_code: string
  sold_at: string

  // eBay metadata
  condition_id: string | null
  category_id: string | null
  authenticity_guarantee: boolean

  // Seller info
  seller_feedback_score: number | null
  seller_feedback_percentage: number | null

  // Shipping
  shipping_cost_cents: number | null

  // Outlier detection (initially FALSE, updated later by outlier detection job)
  is_outlier: boolean
  outlier_reason: string | null

  // Exclusion logic
  exclusion_reason: string | null

  // Metadata
  raw_response: Record<string, unknown>
  fetched_at: string
}

// ============================================================================
// CONFIDENCE MAPPING
// ============================================================================

/**
 * Map size confidence level to numeric score
 * Used by GENERATED included_in_metrics column
 */
function mapSizeConfidenceToScore(
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | undefined
): number | null {
  if (!confidence) return null

  switch (confidence) {
    case 'HIGH':
      return 1.0
    case 'MEDIUM':
      return 0.7
    case 'LOW':
      return 0.3
    default:
      return null
  }
}

// ============================================================================
// EXCLUSION REASON DETERMINATION
// ============================================================================

/**
 * Determine exclusion reason based on item properties
 * Returns null if item should be included in metrics
 */
function determineExclusionReason(
  item: EbaySoldItem,
  conditionId: number | undefined
): string | null {
  // Rule 1: Only condition 1000 (NEW) is included
  if (conditionId && conditionId !== 1000) {
    return 'not_new_condition'
  }

  // Rule 2: Must have authenticity guarantee
  if (!item.authenticityVerification) {
    return 'no_authenticity_guarantee'
  }

  // Rule 3: Must have size
  if (!item.sizeInfo) {
    return 'missing_size'
  }

  // Rule 4: Size system must be known (not UNKNOWN)
  if (item.sizeInfo.system === 'UNKNOWN') {
    return 'size_system_unknown'
  }

  // Rule 5: For AG items, ONLY accept HIGH confidence (variation-sourced) sizes
  // AG sellers are required to specify size correctly through eBay's variation system
  // We should trust eBay's data as ground truth, not title parsing
  const confidenceScore = mapSizeConfidenceToScore(item.sizeInfo.confidence)
  if (confidenceScore === null || confidenceScore < 1.0) {
    // Only HIGH (1.0) confidence allowed for AG items
    // This ensures we're using eBay's verified variation data, not title extraction
    return 'size_not_from_variations'
  }

  // All rules passed
  return null
}

// ============================================================================
// PRICE CONVERSION
// ============================================================================

/**
 * Convert price from major units (e.g., 99.99) to cents (e.g., 9999)
 */
function priceToCents(price: number): number {
  return Math.round(price * 100)
}

// ============================================================================
// TRANSACTION ROW MAPPING
// ============================================================================

/**
 * Transform EbaySoldItem to ebay_sold_transactions row
 */
function mapItemToTransactionRow(
  item: EbaySoldItem,
  searchQuery: string,
  marketplaceId: string
): EbayTransactionRow {
  // Enrich item first (populates extractedSKU, sizeInfo, shippingCost)
  enrichEbaySoldItem(item)

  // SKU: Use extracted SKU, fallback to search query
  const sku = item.extractedSKU || searchQuery

  // Size: Use enriched sizeInfo
  const sizeKey = item.sizeInfo?.normalizedKey || null
  const sizeNumeric = sizeKey
    ? parseFloat(sizeKey.replace(/[^0-9.]/g, '')) || null
    : null
  const sizeSystem = item.sizeInfo?.system === 'UNKNOWN' ? null : item.sizeInfo?.system || null
  const sizeConfidence = mapSizeConfidenceToScore(item.sizeInfo?.confidence)

  // Determine exclusion reason
  const exclusionReason = determineExclusionReason(item, item.conditionId)

  // Build row
  return {
    // Provider identification
    ebay_item_id: item.itemId,
    marketplace_id: marketplaceId,

    // Product identification
    sku,
    size_key: sizeKey,
    size_numeric: sizeNumeric,
    size_system: sizeSystem,
    size_confidence: sizeConfidence,

    // Transaction details
    sale_price_cents: priceToCents(item.price),
    currency_code: item.currency,
    sold_at: item.soldAt,

    // eBay metadata
    condition_id: item.conditionId ? String(item.conditionId) : null,
    category_id: item.categoryId || null,
    authenticity_guarantee: !!item.authenticityVerification,

    // Seller info
    seller_feedback_score: item.seller?.feedbackScore || null,
    seller_feedback_percentage: item.seller?.feedbackPercentage
      ? parseFloat(item.seller.feedbackPercentage)
      : null,

    // Shipping
    shipping_cost_cents: item.shippingCost ? priceToCents(item.shippingCost) : null,

    // Outlier detection (initially FALSE, updated by outlier detection job)
    is_outlier: false,
    outlier_reason: null,

    // Exclusion logic
    exclusion_reason: exclusionReason,

    // Metadata
    raw_response: {
      itemId: item.itemId,
      title: item.title,
      soldAt: item.soldAt,
      conditionId: item.conditionId,
      categoryId: item.categoryId,
      extractedSKU: item.extractedSKU,
      sizeInfo: item.sizeInfo,
    },
    fetched_at: new Date().toISOString(),
  }
}

// ============================================================================
// INGESTION FUNCTION
// ============================================================================

/**
 * Ingest eBay sold items into ebay_sold_transactions table
 *
 * @param items - Array of EbaySoldItem from Browse API (with full details)
 * @param options - Context for normalization
 * @returns Array of inserted rows (or rows that would be inserted if dryRun=true)
 */
export async function ingestEbayTransactions(
  items: EbaySoldItem[],
  options: TransactionIngestionOptions
): Promise<EbayTransactionRow[]> {
  const { searchQuery, marketplaceId = 'EBAY_GB', dryRun = false } = options

  if (items.length === 0) {
    console.log('[eBay Transaction Ingestion] No items to ingest')
    return []
  }

  // Transform items to transaction rows
  const rows = items.map((item) => mapItemToTransactionRow(item, searchQuery, marketplaceId))

  console.log('[eBay Transaction Ingestion] Prepared rows:', {
    searchQuery,
    marketplaceId,
    totalItems: items.length,
    rowsPrepared: rows.length,
    includedInMetrics: rows.filter((r) => r.exclusion_reason === null).length,
    excluded: rows.filter((r) => r.exclusion_reason !== null).length,
    exclusionReasons: Object.entries(
      rows.reduce(
        (acc, r) => {
          if (r.exclusion_reason) {
            acc[r.exclusion_reason] = (acc[r.exclusion_reason] || 0) + 1
          }
          return acc
        },
        {} as Record<string, number>
      )
    ),
  })

  // If dry run, return rows without inserting
  if (dryRun) {
    console.log('[eBay Transaction Ingestion] DRY RUN - Not inserting rows')
    return rows
  }

  // Insert into database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('ebay_sold_transactions')
    .upsert(rows, {
      onConflict: 'ebay_item_id,marketplace_id',
      ignoreDuplicates: false, // Update if exists
    })
    .select()

  if (error) {
    console.error('[eBay Transaction Ingestion] Failed to upsert transactions:', {
      error,
      searchQuery,
      marketplaceId,
      rowCount: rows.length,
    })
    throw error
  }

  console.log('[eBay Transaction Ingestion] Successfully upserted:', {
    searchQuery,
    marketplaceId,
    rowCount: data?.length || rows.length,
  })

  return data || rows
}

// ============================================================================
// STATS HELPER
// ============================================================================

/**
 * Get ingestion stats for a specific SKU
 */
export async function getTransactionStats(sku: string, marketplaceId: string = 'EBAY_GB') {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('ebay_sold_transactions')
    .select('*')
    .eq('sku', sku)
    .eq('marketplace_id', marketplaceId)

  if (error) {
    console.error('[eBay Transaction Stats] Query failed:', error)
    return null
  }

  if (!data || data.length === 0) {
    return {
      sku,
      marketplaceId,
      totalTransactions: 0,
      includedInMetrics: 0,
      excluded: 0,
      exclusionReasons: {},
    }
  }

  const included = data.filter((r) => r.included_in_metrics)
  const excluded = data.filter((r) => !r.included_in_metrics)

  const exclusionReasons = excluded.reduce(
    (acc, r) => {
      const reason = r.exclusion_reason || 'unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    sku,
    marketplaceId,
    totalTransactions: data.length,
    includedInMetrics: included.length,
    excluded: excluded.length,
    exclusionReasons,
    sizeSystems: Object.entries(
      data.reduce(
        (acc, r) => {
          const system = r.size_system || 'NULL'
          acc[system] = (acc[system] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
    ),
    sizeConfidence: {
      high: data.filter((r) => r.size_confidence === 1.0).length,
      medium: data.filter((r) => r.size_confidence === 0.7).length,
      low: data.filter((r) => r.size_confidence === 0.3).length,
      null: data.filter((r) => r.size_confidence === null).length,
    },
  }
}
