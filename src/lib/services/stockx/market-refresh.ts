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
import { ingestStockXMarketData } from '../ingestion/stockx-mapper'

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

export interface MultiRegionSyncResult {
  success: boolean
  primaryRegion: string
  primaryResult: RefreshMarketDataResult
  secondaryResults: Record<string, RefreshMarketDataResult>
  totalSnapshotsCreated: number
}

// ============================================================================
// HELPER: Get Currency from Region
// ============================================================================

/**
 * Map user region to currency code
 */
export function getCurrencyFromRegion(region?: string): 'USD' | 'GBP' | 'EUR' {
  if (!region) return 'GBP' // Default

  const regionUpper = region.toUpperCase()

  // UK variants
  if (regionUpper === 'UK' || regionUpper === 'GB' || regionUpper === 'GBP') return 'GBP'

  // EU countries
  if (['EU', 'EUR', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI'].includes(regionUpper)) {
    return 'EUR'
  }

  // US/Default
  return 'USD'
}

/**
 * Get all currency codes except the primary one
 */
export function getSecondaryCurrencies(primaryCurrency: 'USD' | 'GBP' | 'EUR'): Array<'USD' | 'GBP' | 'EUR'> {
  const allCurrencies: Array<'USD' | 'GBP' | 'EUR'> = ['USD', 'GBP', 'EUR']
  return allCurrencies.filter(c => c !== primaryCurrency)
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
    // Step 1.5: Look up product_id from stockx_products (CORRECT FK REFERENCE)
    // ========================================================================

    const { data: stockxProduct, error: stockxError } = await supabase
      .from('stockx_products')  // ✅ FIXED: Use stockx_products, not product_catalog
      .select('id')
      .eq('stockx_product_id', stockxProductId)
      .single()

    if (stockxError || !stockxProduct) {
      console.warn('[Market Refresh] ⚠️ No stockx_products entry found for stockx_product_id:', stockxProductId)
      console.warn('[Market Refresh] Cannot upsert variants without product_id')
      return {
        success: false,
        variantsCached: 0,
        error: 'Product not found in stockx_products - cannot sync variants',
      }
    }

    const productId = stockxProduct.id  // ✅ FIXED: stockx_products.id (correct FK)
    console.log('[Market Refresh] Found product_id from stockx_products:', productId)

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
          product_id: productId, // Required NOT NULL field
          size_display: variant.variantName,
          variant_value: variant.variantValue, // StockX uses US sizes as primary
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
    // Step 0: Look up product_id from stockx_products (needed for all operations)
    // ========================================================================

    // BUG FIX #15: Query stockx_products, not product_catalog (same as BUG #11 fix)
    const { data: stockxProductRecord, error: stockxError} = await supabase
      .from('stockx_products')  // ✅ CORRECT TABLE
      .select('id, style_id')
      .eq('stockx_product_id', stockxProductId)
      .single()

    if (stockxError || !stockxProductRecord) {
      console.warn('[Market Refresh] ⚠️ No stockx_products entry found for stockx_product_id:', stockxProductId)
      return {
        success: false,
        variantsCached: 0,
        snapshotsCreated: 0,
        error: 'Product not found in stockx_products table',
      }
    }

    const productId = stockxProductRecord.id  // ✅ FIXED: stockx_products.id (correct FK)
    const sku = stockxProductRecord.style_id
    console.log('[Market Refresh] Found product_id from stockx_products:', productId, 'sku:', sku)

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

    // StockX returns market data as a direct array, not { variants: [...] }
    const variants = Array.isArray(marketData) ? marketData : marketData?.variants || []

    console.log('[Market Refresh] 🔍 Market data type:', Array.isArray(marketData) ? 'array' : 'object')
    console.log('[Market Refresh] 🔍 First variant sample:', JSON.stringify(variants[0], null, 2).substring(0, 300))

    if (!variants || variants.length === 0) {
      console.warn('[Market Refresh] ⚠️ No market data returned from StockX')
      return {
        success: true,
        variantsCached: variantsCached,
        snapshotsCreated: 0,
      }
    }

    console.log('[Market Refresh] Found market data for', variants.length, 'variants')

    // ========================================================================
    // Step 2.4: Create raw snapshot for audit trail
    // ========================================================================

    console.log('[Market Refresh] Step 2.4: Creating raw snapshot...')
    const snapshotAt = new Date()
    let rawSnapshotId: string | null = null

    try {
      const { data: rawSnapshot, error: snapshotError } = await supabase
        .from('stockx_raw_snapshots')
        .insert({
          endpoint: 'market_data',
          product_id: stockxProductId,
          style_id: sku,
          currency_code: currencyCode,
          http_status: 200,
          raw_payload: marketData, // Store complete API response
          requested_at: snapshotAt,
        })
        .select('id')
        .single()

      if (snapshotError) {
        console.warn('[Market Refresh] ⚠️ Failed to create raw snapshot (non-fatal):', snapshotError.message)
      } else {
        rawSnapshotId = rawSnapshot.id
        console.log('[Market Refresh] ✅ Raw snapshot created:', rawSnapshotId)
      }
    } catch (error: any) {
      console.warn('[Market Refresh] ⚠️ Raw snapshot creation failed (non-fatal):', error.message)
    }

    // ========================================================================
    // Step 2.5: Ingest to master_market_data (NEW SYSTEM)
    // ========================================================================

    console.log('[Market Refresh] Step 2.5: Ingesting to master_market_data...')

    // Map currency to region code
    const regionCodeMap: Record<string, string> = {
      USD: 'US',
      GBP: 'UK',
      EUR: 'EU',
    }
    const regionCode = regionCodeMap[currencyCode] || 'US'

    // Fetch product metadata (category, gender) for size validation
    let productGender: string | null = null
    let productCategory = 'sneakers'

    if (sku) {
      const { data: productData } = await supabase
        .from('product_catalog')
        .select('gender, category')
        .eq('sku', sku)
        .single()

      if (productData) {
        productGender = productData.gender
        productCategory = productData.category || 'sneakers'
        console.log('[Market Refresh] Found product metadata:', {
          sku,
          gender: productGender,
          category: productCategory,
        })
      } else {
        console.log('[Market Refresh] No product metadata found for SKU:', sku)
      }
    }

    try {
      await ingestStockXMarketData(
        rawSnapshotId, // Link to raw snapshot for audit trail
        variants,
        {
          currencyCode,
          productId: stockxProductId,
          styleId: undefined,
          sku,
          regionCode,
          snapshotAt: snapshotAt,
          category: productCategory,
          gender: productGender || undefined,
        }
      )
      console.log('[StockX→Master] Inserted ' + variants.length + ' rows for SKU ' + (sku || stockxProductId))

      // Refresh materialized view to show latest data immediately
      console.log('[Market Refresh] Refreshing master_market_latest materialized view...')
      await supabase.rpc('refresh_master_market_latest')
      console.log('[Market Refresh] ✅ Materialized view refreshed')
    } catch (error: any) {
      console.warn('[Market Refresh] ⚠️ master_market_data ingestion failed (non-fatal):', error.message)
      // Don't fail the whole sync - continue with legacy stockx_market_snapshots
    }

    // ========================================================================
    // Step 3: Upsert market snapshots to database (LEGACY)
    // ========================================================================

    console.log('[Market Refresh] Step 3: Upserting market snapshots...')
    let snapshotCount = 0
    const now = new Date().toISOString()

    for (const variantData of variants) {
      // Look up variant_id (UUID) from stockx_variants table
      const { data: variantRecord, error: variantLookupError } = await supabase
        .from('stockx_variants')
        .select('id')
        .eq('stockx_variant_id', variantData.variantId)
        .single()

      if (variantLookupError || !variantRecord) {
        console.error('[Market Refresh] Failed to find variant_id for stockx_variant_id:', variantData.variantId, variantLookupError?.message)
        // Skip this variant - can't insert snapshot without variant_id FK
        continue
      }

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
          product_id: productId, // Required NOT NULL field
          stockx_variant_id: variantData.variantId,
          variant_id: variantRecord.id, // ✅ FIXED: Add required variant_id UUID FK
          currency_code: currencyCode,
          lowest_ask: lowestAskPennies,
          highest_bid: highestBidPennies,
          // Note: last_sale_price column doesn't exist in schema
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
// PHASE 2.3: Multi-Region Sync (Best-in-Class Approach)
// ============================================================================

/**
 * Sync product across all regions (USD, GBP, EUR)
 *
 * SMART HYBRID STRATEGY:
 * 1. Sync primary region FIRST (blocking) → user sees data immediately
 * 2. Sync secondary regions AFTER with delay (non-blocking) → builds complete dataset
 *
 * This is the "best-in-class" approach used by companies like Amazon, Booking.com:
 * - User gets instant data for their region
 * - Background jobs populate other regions
 * - Enables cross-region features (arbitrage, price comparison)
 *
 * @param userId - User ID for OAuth
 * @param stockxProductId - StockX product ID
 * @param primaryRegion - User's primary region (determines priority currency)
 * @param syncSecondaryRegions - Whether to sync other regions in background (default: true)
 * @returns Multi-region sync result
 */
export async function syncProductAllRegions(
  userId: string | undefined,
  stockxProductId: string,
  primaryRegion?: string,
  syncSecondaryRegions: boolean = true
): Promise<MultiRegionSyncResult> {
  const primaryCurrency = getCurrencyFromRegion(primaryRegion)

  console.log('[Multi-Region Sync] Starting sync for product:', stockxProductId)
  console.log('[Multi-Region Sync] Primary region:', primaryRegion || 'default', '→', primaryCurrency)
  console.log('[Multi-Region Sync] Sync secondary regions:', syncSecondaryRegions)

  // ========================================================================
  // STEP 1: Sync primary region FIRST (blocking)
  // ========================================================================

  console.log(`[Multi-Region Sync] Syncing PRIMARY region (${primaryCurrency})...`)
  const primaryResult = await refreshStockxMarketData(userId, stockxProductId, primaryCurrency)

  if (!primaryResult.success) {
    console.error('[Multi-Region Sync] ❌ Primary region sync failed:', primaryResult.error)
    return {
      success: false,
      primaryRegion: primaryCurrency,
      primaryResult,
      secondaryResults: {},
      totalSnapshotsCreated: primaryResult.snapshotsCreated,
    }
  }

  console.log(`[Multi-Region Sync] ✅ Primary region (${primaryCurrency}) synced: ${primaryResult.snapshotsCreated} snapshots`)

  // ========================================================================
  // STEP 1.5: Enrich product metadata (non-blocking, best effort)
  // ========================================================================

  console.log('[Multi-Region Sync] Enriching product metadata...')
  try {
    const metadataResult = await enrichProductMetadata(userId, stockxProductId)
    if (metadataResult.success) {
      console.log(`[Multi-Region Sync] ✅ Product metadata enriched: ${metadataResult.fieldsUpdated} fields`)
    } else {
      console.warn('[Multi-Region Sync] ⚠️ Metadata enrichment failed (non-fatal):', metadataResult.error)
    }
  } catch (error: any) {
    console.warn('[Multi-Region Sync] ⚠️ Metadata enrichment error (non-fatal):', error.message)
  }

  // ========================================================================
  // STEP 2: Sync secondary regions in background (non-blocking)
  // ========================================================================

  const secondaryResults: Record<string, RefreshMarketDataResult> = {}
  let totalSnapshotsCreated = primaryResult.snapshotsCreated

  if (syncSecondaryRegions) {
    const secondaryCurrencies = getSecondaryCurrencies(primaryCurrency)

    console.log(`[Multi-Region Sync] Syncing ${secondaryCurrencies.length} secondary regions: ${secondaryCurrencies.join(', ')}`)

    // Delay slightly to prioritize primary region
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Sync each secondary region
    for (const currency of secondaryCurrencies) {
      try {
        console.log(`[Multi-Region Sync] Syncing secondary region (${currency})...`)
        const result = await refreshStockxMarketData(userId, stockxProductId, currency)

        secondaryResults[currency] = result
        totalSnapshotsCreated += result.snapshotsCreated

        if (result.success) {
          console.log(`[Multi-Region Sync] ✅ Secondary region (${currency}) synced: ${result.snapshotsCreated} snapshots`)
        } else {
          console.warn(`[Multi-Region Sync] ⚠️  Secondary region (${currency}) failed:`, result.error)
        }

        // Small delay between regions to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error: any) {
        console.error(`[Multi-Region Sync] ❌ Secondary region (${currency}) error:`, error.message)
        secondaryResults[currency] = {
          success: false,
          variantsCached: 0,
          snapshotsCreated: 0,
          error: error.message,
        }
      }
    }
  }

  // ========================================================================
  // Success
  // ========================================================================

  console.log('[Multi-Region Sync] ✅ Complete:', {
    primaryRegion: primaryCurrency,
    primarySnapshots: primaryResult.snapshotsCreated,
    secondaryRegions: Object.keys(secondaryResults).length,
    totalSnapshots: totalSnapshotsCreated,
  })

  return {
    success: true,
    primaryRegion: primaryCurrency,
    primaryResult,
    secondaryResults,
    totalSnapshotsCreated,
  }
}

// ============================================================================
// PHASE 2.4: Product Metadata Enrichment
// ============================================================================

export interface ProductMetadataResult {
  success: boolean
  fieldsUpdated: number
  error?: string
}

/**
 * Enrich product_catalog with metadata from StockX
 *
 * Fetches full product details and populates:
 * - colorway
 * - retail_price
 * - release_date
 * - category
 * - gender
 * - image_url
 *
 * @param userId - User ID for OAuth
 * @param stockxProductId - StockX product ID
 * @returns Enrichment result
 */
export async function enrichProductMetadata(
  userId: string | undefined,
  stockxProductId: string
): Promise<ProductMetadataResult> {
  console.log('[Product Metadata] Enriching product:', stockxProductId)

  try {
    const supabase = createServiceClient()
    const catalogService = new StockxCatalogService(userId)

    // ========================================================================
    // Step 1: Fetch full product details from StockX
    // ========================================================================

    console.log('[Product Metadata] Fetching product details from StockX...')
    let product
    try {
      product = await catalogService.getProduct(stockxProductId)
    } catch (error: any) {
      console.error('[Product Metadata] ⚠️ StockX API failed:', error.message)
      return {
        success: false,
        fieldsUpdated: 0,
        error: `StockX API error: ${error.message}`,
      }
    }

    if (!product) {
      console.warn('[Product Metadata] ⚠️ No product returned from StockX')
      return {
        success: false,
        fieldsUpdated: 0,
        error: 'Product not found',
      }
    }

    console.log('[Product Metadata] ✅ Product details fetched:', product.productName)

    // ========================================================================
    // Step 2: Extract metadata fields
    // ========================================================================

    const metadata: Record<string, any> = {}
    let fieldsUpdated = 0

    if (product.colorway) {
      metadata.colorway = product.colorway
      fieldsUpdated++
    }

    if (product.retailPrice) {
      // retailPrice might be a number or string like "150.00"
      const retailPricePennies = typeof product.retailPrice === 'number'
        ? Math.round(product.retailPrice * 100)
        : Math.round(parseFloat(product.retailPrice) * 100)
      metadata.retail_price = retailPricePennies
      fieldsUpdated++
    }

    if (product.releaseDate) {
      metadata.release_date = product.releaseDate
      fieldsUpdated++
    }

    if (product.category) {
      metadata.category = product.category
      fieldsUpdated++
    }

    if (product.gender) {
      metadata.gender = product.gender
      fieldsUpdated++
    }

    if (product.image) {
      metadata.image_url = product.image
      fieldsUpdated++
    }

    console.log('[Product Metadata] Extracted', fieldsUpdated, 'metadata fields')

    // ========================================================================
    // Step 3: Update product_catalog
    // ========================================================================

    if (fieldsUpdated > 0) {
      console.log('[Product Metadata] Updating product_catalog...')

      const { error: updateError } = await supabase
        .from('product_catalog')
        .update(metadata)
        .eq('stockx_product_id', stockxProductId)

      if (updateError) {
        console.error('[Product Metadata] ❌ Update failed:', updateError.message)
        return {
          success: false,
          fieldsUpdated: 0,
          error: `Database update failed: ${updateError.message}`,
        }
      }

      console.log('[Product Metadata] ✅ Updated product_catalog with', fieldsUpdated, 'fields')
    } else {
      console.log('[Product Metadata] ⚠️ No metadata fields to update')
    }

    return {
      success: true,
      fieldsUpdated,
    }

  } catch (error: any) {
    console.error('[Product Metadata] Unexpected error:', error)
    return {
      success: false,
      fieldsUpdated: 0,
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
