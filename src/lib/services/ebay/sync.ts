/**
 * eBay Market Data Sync (Phase 1 - Manual, Read-Only)
 * Provides manual sync function for eBay sneaker data → master_market_data
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSTRAINTS:
 * - NOT wired into any automatic flows / cron jobs / workers
 * - This is a callable helper only (manual testing)
 * - Behind EBAY_MARKET_DATA_ENABLED feature flag
 * - NEW + AUTHENTICITY_GUARANTEE sneakers only
 * - Sold items only (for market data)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Usage:
 *   const result = await syncEbaySneakersForQuery('Jordan 4 Black Cat')
 */

import { searchAuthenticatedNewSneakers } from './sneakers'
import { ingestEbayBrowseSearchResults } from '../ingestion/ebay-mapper'
import { ebayConfig } from './config'

export interface SyncEbayOptions {
  currency?: string // default: 'GBP'
  limit?: number // default: 50
  soldItemsOnly?: boolean // default: true
}

export interface SyncEbayResult {
  query: string
  currency: string
  itemsCount: number
  uniqueSkuSizeCount: number | null // How many unique (sku, size) combos ingested
  success: boolean
  error?: string
}

/**
 * Sync eBay sneaker market data for a search query
 *
 * This is the MAIN function for eBay → master_market_data integration.
 *
 * Flow:
 * 1. Search eBay for authenticated NEW sneakers (soldItemsOnly: true)
 * 2. Ingest results into master_market_data (with SKU/size extraction)
 *
 * @param query - Search query (SKU or product name, e.g., "DD1391-100" or "Jordan 4 Black Cat")
 * @param options - Sync options
 * @returns Sync result summary
 */
export async function syncEbaySneakersForQuery(
  query: string,
  options: SyncEbayOptions = {}
): Promise<SyncEbayResult> {
  const currency = options.currency ?? 'GBP'
  const limit = options.limit ?? 50
  const soldItemsOnly = options.soldItemsOnly ?? true

  // Check if feature is enabled
  if (!ebayConfig.marketDataEnabled) {
    console.warn('[eBay Sync] Market data sync disabled (EBAY_MARKET_DATA_ENABLED != true)')
    return {
      query,
      currency,
      itemsCount: 0,
      uniqueSkuSizeCount: null,
      success: false,
      error: 'eBay market data feature is disabled',
    }
  }

  console.log('[eBay Sync] Starting sync', {
    query,
    currency,
    limit,
    soldItemsOnly,
  })

  try {
    // 1. Fetch authenticated NEW sneakers from eBay (with full details for variations/sizes)
    const result = await searchAuthenticatedNewSneakers(query, {
      limit,
      soldItemsOnly,
      fetchFullDetails: true, // CRITICAL: Get variations[] for size extraction
    })

    console.log('[eBay Sync] Fetched eBay items', {
      query,
      itemsCount: result.items.length,
      fullDetailsFetched: result.fullDetailsFetched,
      successRate: result.items.length > 0
        ? `${((result.fullDetailsFetched / result.items.length) * 100).toFixed(1)}%`
        : 'N/A',
    })

    if (result.items.length === 0) {
      console.warn('[eBay Sync] No items found for query', { query })
      return {
        query,
        currency,
        itemsCount: 0,
        uniqueSkuSizeCount: 0,
        success: true, // Not an error, just no results
      }
    }

    // 2. Ingest into master_market_data (with SKU/size extraction & aggregation)
    await ingestEbayBrowseSearchResults(result.items, {
      searchQuery: query,
      currencyCode: currency,
      soldItemsOnly,
    })

    console.log('[eBay Sync] Sync completed successfully', {
      query,
      currency,
      itemsCount: result.items.length,
    })

    return {
      query,
      currency,
      itemsCount: result.items.length,
      uniqueSkuSizeCount: null, // TODO: return from mapper
      success: true,
    }
  } catch (error) {
    console.error('[eBay Sync] Sync failed', {
      query,
      currency,
      error,
    })

    return {
      query,
      currency,
      itemsCount: 0,
      uniqueSkuSizeCount: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
