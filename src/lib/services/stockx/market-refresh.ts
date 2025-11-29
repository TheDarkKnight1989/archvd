/**
 * StockX Market Data Refresh Pipeline
 *
 * STABILISATION MODE - Clean, DB-only variant caching and market data refresh
 * NO fallbacks, NO inference, ONLY StockX API → Database
 *
 * PHASE 3: Manual sync pipeline
 * - syncStockxProduct: Safe, manual sync function for use in API routes and scripts
 * - NO auto-refresh on page load
 * - NO auto-heal
 */

import { createClient as createServiceClient } from '@/lib/supabase/service'
import { StockxCatalogService } from './catalog'

// ============================================================================
// Types
// ============================================================================

export interface CacheVariantsResult {
  success: boolean
  variantsCached: number
  error?: string
}

export interface RefreshMarketDataResult {
  success: boolean
  variantsCached: number
  snapshotsCreated: number
  error?: string
  warning?: string
}

// ============================================================================
// PHASE 2.1: Cache All Variants for a Product
// ============================================================================

/**
 * Fetch and cache ALL size variants for a StockX product
 *
 * Calls StockX variants API and upserts every variant to stockx_variants table.
 * Idempotent - safe to call multiple times.
 *
 * @param userId - User ID for OAuth (uses client credentials if not provided)
 * @param stockxProductId - StockX product ID
 * @returns Number of variants cached
 */
export async function cacheAllStockxVariantsForProduct(
  userId: string | undefined,
  stockxProductId: string
): Promise<CacheVariantsResult> {
  console.log('[Market Refresh] Caching variants for product:', stockxProductId)

  try {
    const supabase = createServiceClient()
    const catalogService = new StockxCatalogService(userId)

    // ========================================================================
    // Step 1: Fetch ALL variants from StockX API
    // ========================================================================

    console.log('[Market Refresh] Fetching variants from StockX API...')
    let variants
    try {
      variants = await catalogService.getProductVariants(stockxProductId)
    } catch (error: any) {
      // Don't throw - log and return 0
      console.error('[Market Refresh] ⚠️ StockX API failed:', error.message)
      return {
        success: false,
        variantsCached: 0,
        error: `StockX API error: ${error.message}`,
      }
    }

    if (!variants || variants.length === 0) {
      console.warn('[Market Refresh] ⚠️ No variants returned from StockX')
      return {
        success: true,
        variantsCached: 0,
      }
    }

    console.log('[Market Refresh] Found', variants.length, 'variants from StockX')

    // ========================================================================
    // Step 2: Upsert ALL variants to database
    // ========================================================================

    let upsertCount = 0
    for (const variant of variants) {
      const { error: variantError } = await supabase
        .from('stockx_variants')
        .upsert({
          stockx_variant_id: variant.variantId,
          stockx_product_id: stockxProductId,
          size_display: variant.variantName,
          size_us: variant.variantValue, // StockX uses US sizes as primary
          // UK/EU sizes can be derived via size conversion in queries
        }, {
          onConflict: 'stockx_variant_id',
          ignoreDuplicates: false, // Always update with latest data
        })

      if (variantError) {
        console.error('[Market Refresh] Failed to upsert variant:', variant.variantId, variantError.message)
        // Continue with other variants
      } else {
        upsertCount++
      }
    }

    console.log('[Market Refresh] ✅ Cached', upsertCount, 'variants')

    return {
      success: true,
      variantsCached: upsertCount,
    }

  } catch (error: any) {
    console.error('[Market Refresh] Unexpected error:', error)
    return {
      success: false,
      variantsCached: 0,
      error: error.message,
    }
  }
}

// ============================================================================
// PHASE 2.2: Refresh Market Data for a Product
// ============================================================================

/**
 * Refresh market data for a StockX product
 *
 * Process:
 * 1. Cache all variants (if not already cached)
 * 2. Fetch market data from StockX API (GBP currency)
 * 3. Upsert to stockx_market_snapshots
 * 4. stockx_market_latest view will automatically show latest data
 *
 * @param userId - User ID for OAuth
 * @param stockxProductId - StockX product ID
 * @param currencyCode - Currency for market data (default: GBP)
 * @returns Refresh result with counts
 */
export async function refreshStockxMarketData(
  userId: string | undefined,
  stockxProductId: string,
  currencyCode: 'GBP' | 'USD' | 'EUR' = 'GBP'
): Promise<RefreshMarketDataResult> {
  console.log('[Market Refresh] Refreshing market data for product:', stockxProductId, currencyCode)

  try {
    const supabase = createServiceClient()

    // ========================================================================
    // Step 1: Cache variants first (idempotent) - GRACEFUL FAILURE
    // ========================================================================

    console.log('[Market Refresh] Step 1: Caching variants...')
    let variantsCached = 0
    let variantsWarning: string | null = null

    try {
      const variantsResult = await cacheAllStockxVariantsForProduct(userId, stockxProductId)

      if (!variantsResult.success) {
        // Check if it's a 401 (StockX denied access to variants endpoint)
        const is401 = variantsResult.error?.includes('401') || variantsResult.error?.includes('Unauthorized')

        if (is401) {
          console.warn('[Market Refresh] ⚠️ StockX denied variants endpoint (401) - will sync market data for existing variants only')
          variantsWarning = 'StockX denied variants endpoint; syncing market data for existing variants only'
        } else {
          // Non-401 error - this is a real failure
          console.error('[Market Refresh] ❌ Variant caching failed:', variantsResult.error)
          return {
            success: false,
            variantsCached: 0,
            snapshotsCreated: 0,
            error: `Variant caching failed: ${variantsResult.error}`,
          }
        }
      } else {
        variantsCached = variantsResult.variantsCached
        console.log('[Market Refresh] ✅ Variants cached:', variantsCached)
      }
    } catch (error: any) {
      // Check if it's a 401 error
      const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized')

      if (is401) {
        console.warn('[Market Refresh] ⚠️ StockX denied variants endpoint (401) - will sync market data for existing variants only')
        variantsWarning = 'StockX denied variants endpoint; syncing market data for existing variants only'
      } else {
        throw error // Re-throw non-401 errors
      }
    }

    // ========================================================================
    // Step 2: Fetch market data from StockX API
    // ========================================================================

    console.log('[Market Refresh] Step 2: Fetching market data from StockX...')
    const catalogService = new StockxCatalogService(userId)

    // Fetch market data for this product in specified currency
    let marketData
    try {
      // Use the catalog service to fetch market data
      // The API endpoint is: GET /v2/catalog/products/{productId}/market-data?currencyCode=GBP
      const client = (catalogService as any).client
      marketData = await client.request(
        `/v2/catalog/products/${stockxProductId}/market-data?currencyCode=${currencyCode}`
      )
    } catch (error: any) {
      console.error('[Market Refresh] ⚠️ StockX market data API failed:', error.message)

      // Check if it's a 401 (StockX denied access to market data endpoint)
      const is401 = error.message?.includes('401') || error.message?.includes('Unauthorized')

      if (is401) {
        console.warn('[Market Refresh] ⚠️ StockX denied market data endpoint (401)')

        // If BOTH variants and market data were denied, return warning but success
        if (variantsWarning) {
          return {
            success: true,
            variantsCached: 0,
            snapshotsCreated: 0,
            warning: 'StockX denied both variants and market data endpoints; no data could be synced',
          }
        }

        // Only market data was denied, but we did cache variants
        return {
          success: true,
          variantsCached: variantsCached,
          snapshotsCreated: 0,
          warning: 'StockX denied market data endpoint; variants were cached but no market snapshots created',
        }
      }

      // Non-401 error - this is a real failure
      return {
        success: false,
        variantsCached: variantsCached,
        snapshotsCreated: 0,
        error: `Market data API error: ${error.message}`,
      }
    }

    if (!marketData || !marketData.variants || marketData.variants.length === 0) {
      console.warn('[Market Refresh] ⚠️ No market data returned from StockX')
      return {
        success: true,
        variantsCached: variantsCached,
        snapshotsCreated: 0,
      }
    }

    console.log('[Market Refresh] Found market data for', marketData.variants.length, 'variants')

    // ========================================================================
    // Step 3: Upsert market snapshots to database
    // ========================================================================

    console.log('[Market Refresh] Step 3: Upserting market snapshots...')
    let snapshotCount = 0
    const now = new Date().toISOString()

    for (const variantData of marketData.variants) {
      // Convert StockX API response to our schema
      // StockX returns amounts as strings like "150.00"
      // We store as integer pennies: 150.00 → 15000
      const lowestAskPennies = variantData.lowestAskAmount
        ? Math.round(parseFloat(variantData.lowestAskAmount) * 100)
        : null

      const highestBidPennies = variantData.highestBidAmount
        ? Math.round(parseFloat(variantData.highestBidAmount) * 100)
        : null

      const lastSalePennies = variantData.lastSaleAmount
        ? Math.round(parseFloat(variantData.lastSaleAmount) * 100)
        : null

      const { error: snapshotError } = await supabase
        .from('stockx_market_snapshots')
        .insert({
          stockx_product_id: stockxProductId,
          stockx_variant_id: variantData.variantId,
          currency_code: currencyCode,
          lowest_ask: lowestAskPennies,
          highest_bid: highestBidPennies,
          last_sale_price: lastSalePennies,
          snapshot_at: now,
        })

      if (snapshotError) {
        console.error('[Market Refresh] Failed to insert snapshot:', variantData.variantId, snapshotError.message)
        // Continue with other variants
      } else {
        snapshotCount++
      }
    }

    console.log('[Market Refresh] ✅ Created', snapshotCount, 'market snapshots')

    // ========================================================================
    // Step 4: Update last_synced_at timestamps
    // ========================================================================

    console.log('[Market Refresh] Step 4: Updating last_synced_at timestamps...')
    const syncTimestamp = new Date().toISOString()

    // Update stockx_products.last_synced_at
    const { error: productUpdateError } = await supabase
      .from('stockx_products')
      .update({ last_synced_at: syncTimestamp })
      .eq('stockx_product_id', stockxProductId)

    if (productUpdateError) {
      console.warn('[Market Refresh] ⚠️ Failed to update stockx_products.last_synced_at:', productUpdateError.message)
    } else {
      console.log('[Market Refresh] ✅ Updated stockx_products.last_synced_at:', syncTimestamp)
    }

    // Update inventory_market_links.last_sync_success_at for all items linked to this product
    const { error: linksUpdateError, count } = await supabase
      .from('inventory_market_links')
      .update({ last_sync_success_at: syncTimestamp })
      .eq('stockx_product_id', stockxProductId)

    if (linksUpdateError) {
      console.warn('[Market Refresh] ⚠️ Failed to update inventory_market_links.last_sync_success_at:', linksUpdateError.message)
    } else {
      console.log('[Market Refresh] ✅ Updated inventory_market_links.last_sync_success_at for', count || 0, 'items')
    }

    // ========================================================================
    // Success
    // ========================================================================

    console.log('[StockX Sync] ✅ productId=' + stockxProductId + ', variants=' + variantsCached + ', snapshots=' + snapshotCount + ', last_synced_at=' + syncTimestamp)

    if (variantsWarning) {
      console.warn('[StockX Sync] ⚠️ Warning:', variantsWarning)
    }

    return {
      success: true,
      variantsCached: variantsCached,
      snapshotsCreated: snapshotCount,
      warning: variantsWarning || undefined,
    }

  } catch (error: any) {
    console.error('[Market Refresh] Unexpected error:', error)
    return {
      success: false,
      variantsCached: 0,
      snapshotsCreated: 0,
      error: error.message,
    }
  }
}

// ============================================================================
// PHASE 3: Public Export for Manual Sync
// ============================================================================

/**
 * Manually sync StockX product data (variants + market data)
 *
 * This is the SAFE, MANUAL sync function for PHASE 3.
 * Use this in:
 * - API routes triggered by user button clicks
 * - Background scripts (sync-all-stockx-products.mjs)
 *
 * NO auto-refresh, NO auto-heal, manual-only.
 *
 * @param userId - User ID for OAuth token
 * @param stockxProductId - StockX product ID to sync
 * @param currencyCode - Currency for market data (default: GBP)
 * @returns Sync result with counts
 */
export async function syncStockxProduct(
  userId: string | undefined,
  stockxProductId: string,
  currencyCode: 'GBP' | 'USD' | 'EUR' = 'GBP'
): Promise<RefreshMarketDataResult> {
  console.log('[PHASE 3 Sync] Manual sync requested:', {
    userId: userId ? 'yes' : 'no',
    stockxProductId,
    currencyCode,
  })

  return refreshStockxMarketData(userId, stockxProductId, currencyCode)
}
