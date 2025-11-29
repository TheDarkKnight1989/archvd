/**
 * StockX Market Data Refresh Service
 *
 * ARCHITECTURE:
 * - stockx_market_latest is the ONLY source of truth for StockX prices
 * - This service refreshes that cache from the StockX API
 * - Components/pages NEVER call StockX API directly
 * - All reads go through stockx_market_latest table
 *
 * USAGE:
 * - SKU Market page: calls ensureFreshStockxMarketData() before rendering
 * - Background jobs: can call refreshStockxMarketForProduct() directly
 * - Inventory: NEVER refreshes, only reads from stockx_market_latest
 */

import { createClient } from '@/lib/supabase/service'
import { getStockxClient } from './client'
import { upsertMarketSnapshot, upsertStockxProduct, upsertStockxVariant } from '@/lib/market/upsert'

// ============================================================================
// Types
// ============================================================================

interface StockxV2Variant {
  variantId: string
  variantValue?: string
  size?: string
  sizeChart?: {
    displayOptions?: Array<{
      type?: string
      value?: string
    }>
  }
}

interface StockxV2MarketDataVariant {
  variantId: string
  lowestAskAmount?: number | string | null
  highestBidAmount?: number | string | null
  standardMarketData?: {
    lowestAsk?: number | string | null
    highestBidAmount?: number | string | null
  }
}

interface RefreshResult {
  success: boolean
  variantCount: number
  error?: string
}

interface FreshnessResult {
  stale: boolean
  error?: string
  lastUpdated?: Date | null
}

// ============================================================================
// Core Refresh Functions
// ============================================================================

/**
 * Fetch and cache all variants (sizes) for a product
 * This must be called BEFORE refreshing market data
 *
 * @param userId - User ID for OAuth token
 * @param stockxProductId - StockX product UUID
 * @returns Number of variants cached
 */
async function cacheProductVariants(
  userId: string,
  stockxProductId: string
): Promise<number> {
  console.log('[StockX Variant Cache] Fetching variants for', stockxProductId)

  try {
    const client = getStockxClient(userId)
    const url = `/v2/catalog/products/${stockxProductId}/variants?currencyCode=GBP`

    const response = await client.request<StockxV2Variant[]>(url)

    if (!Array.isArray(response) || response.length === 0) {
      console.warn('[StockX Variant Cache] No variants returned')
      return 0
    }

    console.log('[StockX Variant Cache] API returned', response.length, 'variants')

    // Upsert each variant using existing helper
    let cachedCount = 0
    for (const variant of response) {
      try {
        await upsertStockxVariant({
          stockxVariantId: variant.variantId,
          stockxProductId: stockxProductId,
          size: variant.size,
          variantValue: variant.variantValue || variant.size,
        })
        cachedCount++
      } catch (error: any) {
        console.error('[StockX Variant Cache] Failed to cache variant', variant.variantId, error)
      }
    }

    console.log('[StockX Variant Cache] ✅ Cached', cachedCount, 'variants')
    return cachedCount
  } catch (error: any) {
    console.error('[StockX Variant Cache] ❌ Failed to fetch variants:', error)
    // Don't throw - we'll use whatever variants are already in the DB
    return 0
  }
}

/**
 * Refresh StockX market data for a product from live API
 * Step 1: Cache all variants (sizes)
 * Step 2: Fetch and upsert market data for all variants
 *
 * @param userId - User ID for OAuth token
 * @param stockxProductId - StockX product UUID
 * @returns Success status and variant count
 */
export async function refreshStockxMarketForProduct(
  userId: string,
  stockxProductId: string
): Promise<RefreshResult> {
  console.log('[StockX Market Refresh] Starting refresh', {
    userId,
    stockxProductId,
  })

  try {
    // STEP 1: Cache all variants first (this populates stockx_variants table)
    const variantsCached = await cacheProductVariants(userId, stockxProductId)
    console.log('[StockX Market Refresh] Step 1: Cached', variantsCached, 'variants')

    // Get user's OAuth client
    const client = getStockxClient(userId)

    // Call StockX V2 API for all variants of this product
    const url = `/v2/catalog/products/${stockxProductId}/market-data?currencyCode=GBP`

    console.log('[StockX Market Refresh] Calling API:', url)

    const response = await client.request<StockxV2MarketDataVariant[]>(url)

    if (!Array.isArray(response) || response.length === 0) {
      console.warn('[StockX Market Refresh] No variants returned from API')
      return {
        success: false,
        variantCount: 0,
        error: 'No variants found',
      }
    }

    console.log('[StockX Market Refresh] API returned', response.length, 'variants')

    // Upsert snapshots using existing upsert function
    // This handles foreign key lookups and inserts into stockx_market_snapshots
    let successCount = 0
    let failureCount = 0

    for (const variant of response) {
      try {
        // Parse prices - API returns strings, we need numbers
        const lowestAsk = parsePrice(variant.lowestAskAmount ?? variant.standardMarketData?.lowestAsk)
        const highestBid = parsePrice(variant.highestBidAmount ?? variant.standardMarketData?.highestBidAmount)

        // Use existing upsert function that handles FK lookups
        const success = await upsertMarketSnapshot({
          stockxProductId: stockxProductId,
          stockxVariantId: variant.variantId,
          currencyCode: 'GBP',
          lowestAsk,
          highestBid,
          salesLast72h: null, // V2 API doesn't provide this
          totalVolume: null, // V2 API doesn't provide this
          averageDeadstockPrice: null,
          volatility: null,
          pricePremium: null,
        })

        if (success) {
          successCount++
        } else {
          failureCount++
        }
      } catch (error: any) {
        console.error('[StockX Market Refresh] Failed to upsert variant', variant.variantId, error)
        failureCount++
      }
    }

    if (failureCount > 0) {
      console.warn('[StockX Market Refresh] ⚠️  Some variants failed:', {
        success: successCount,
        failed: failureCount,
      })
    }

    console.log('[StockX Market Refresh] ✅ Successfully refreshed', successCount, 'variants')

    return {
      success: true,
      variantCount: successCount,
    }
  } catch (error: any) {
    console.error('[StockX Market Refresh] ❌ Refresh failed:', error)

    // Classify error types
    const errorMsg = error.message || 'Unknown error'
    const is401 = errorMsg.includes('401') || errorMsg.includes('Unauthorized')
    const is429 = errorMsg.includes('429') || errorMsg.includes('rate limit')
    const is5xx = errorMsg.match(/50[0-9]/)

    let friendlyError = errorMsg
    if (is401) {
      friendlyError = 'StockX authentication failed'
    } else if (is429) {
      friendlyError = 'StockX rate limit exceeded'
    } else if (is5xx) {
      friendlyError = 'StockX server error'
    }

    return {
      success: false,
      variantCount: 0,
      error: friendlyError,
    }
  }
}

// ============================================================================
// Freshness Check + Conditional Refresh
// ============================================================================

/**
 * Ensure StockX market data is fresh, refresh if stale
 *
 * This is the main entry point for the SKU Market page.
 *
 * Behavior:
 * - Checks if data exists and is younger than TTL
 * - If stale or missing: calls refreshStockxMarketForProduct()
 * - If refresh fails: returns { stale: true, error } but doesn't throw
 * - Callers should still use database data even if stale
 *
 * @param userId - User ID for OAuth token
 * @param stockxProductId - StockX product UUID
 * @param ttlMinutes - Freshness threshold in minutes (default: 30)
 * @returns Staleness status and optional error message
 */
export async function ensureFreshStockxMarketData(
  userId: string,
  stockxProductId: string,
  ttlMinutes: number = 30
): Promise<FreshnessResult> {
  console.log('[StockX Freshness Check] Starting', {
    userId,
    stockxProductId,
    ttlMinutes,
  })

  try {
    const supabase = createClient()

    // Check if data exists and when it was last updated
    const { data: latestRecord, error: queryError } = await supabase
      .from('stockx_market_latest')
      .select('snapshot_at')
      .eq('stockx_product_id', stockxProductId)
      .eq('currency_code', 'GBP')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      console.error('[StockX Freshness Check] Query error:', queryError)
      return { stale: true, error: 'Database query failed' }
    }

    // No data exists - definitely need refresh
    if (!latestRecord) {
      console.log('[StockX Freshness Check] No data found, refreshing...')

      const refreshResult = await refreshStockxMarketForProduct(userId, stockxProductId)

      if (refreshResult.success) {
        return { stale: false }
      } else {
        return {
          stale: true,
          error: refreshResult.error || 'Refresh failed, no existing data',
        }
      }
    }

    // Check age
    const lastUpdated = new Date(latestRecord.snapshot_at)
    const ageMinutes = (Date.now() - lastUpdated.getTime()) / 1000 / 60
    const isStale = ageMinutes > ttlMinutes

    console.log('[StockX Freshness Check] Data age:', {
      lastUpdated: lastUpdated.toISOString(),
      ageMinutes: Math.round(ageMinutes),
      ttlMinutes,
      isStale,
    })

    if (!isStale) {
      // Data is fresh, no refresh needed
      return { stale: false, lastUpdated }
    }

    // Data is stale, try to refresh
    console.log('[StockX Freshness Check] Data is stale, refreshing...')

    const refreshResult = await refreshStockxMarketForProduct(userId, stockxProductId)

    if (refreshResult.success) {
      return { stale: false }
    } else {
      // Refresh failed but we have stale data
      return {
        stale: true,
        error: refreshResult.error,
        lastUpdated,
      }
    }
  } catch (error: any) {
    console.error('[StockX Freshness Check] Unexpected error:', error)
    return {
      stale: true,
      error: error.message || 'Unexpected error',
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse price from API response (handles strings and numbers)
 */
function parsePrice(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
  }
  return null
}
