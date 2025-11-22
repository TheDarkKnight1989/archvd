/**
 * StockX Worker - Batch processor for StockX market data jobs
 * DIRECTIVE COMPLIANT: Uses repaired service layer (catalog.ts, market.ts)
 *
 * WHY: Fetch market data with proper rate limiting and error handling
 * INTEGRATION: Uses StockxCatalogService and StockxMarketService for all API calls
 */

import { createClient } from '@/lib/supabase/service'
import { sleep } from '@/lib/sleep'
import { upsertMarketPriceIfStale, upsertProductCatalog, upsertMarketSnapshot, upsertStockxProduct, upsertStockxVariant } from '@/lib/market/upsert'
import { nowUtc } from '@/lib/time'
import { StockxCatalogService } from '@/lib/services/stockx/catalog'
import { StockxMarketService } from '@/lib/services/stockx/market'

export interface StockXJob {
  id: string
  sku: string
  size: string | null
  user_id?: string | null  // For fetching user's currency preference
}

export interface StockXWorkerResult {
  succeeded: number
  failed: number
  deferred: number
  details: Array<{
    jobId: string
    status: 'done' | 'failed' | 'deferred'
    message?: string
  }>
}

// Rate limiting: 600ms between requests (100/hour with buffer)
const DELAY_MS = 600

/**
 * Process a batch of StockX jobs
 */
export async function processStockXBatch(
  jobs: StockXJob[],
  runId: string
): Promise<StockXWorkerResult> {
  const supabase = createClient()
  const result: StockXWorkerResult = {
    succeeded: 0,
    failed: 0,
    deferred: 0,
    details: [],
  }

  console.log(`[StockX Worker ${runId}] Processing ${jobs.length} jobs`)

  // Get user's base currency (defaults to GBP if not set or no user)
  const getUserCurrency = async (userId: string | null): Promise<string> => {
    if (!userId) return 'GBP'

    const { data: profile } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', userId)
      .single()

    return profile?.base_currency || 'GBP'
  }

  // Process each job with rate limiting
  for (const job of jobs) {
    try {
      console.log(`[StockX Worker ${runId}] Processing ${job.sku}${job.size ? `:${job.size}` : ''}`)

      // Get user's currency preference
      const currencyCode = await getUserCurrency(job.user_id || null)
      console.log(`[StockX Worker ${runId}] Using currency: ${currencyCode}`)

      // 1. Search for product using StockxCatalogService
      const catalogService = new StockxCatalogService(job.user_id || undefined)

      let products
      try {
        products = await catalogService.searchProducts(job.sku, {
          limit: 1,
          currencyCode,
        })
      } catch (error: any) {
        // Check if it's a rate limit error
        if (error.message?.includes('429')) {
          console.log(`[StockX Worker ${runId}] Rate limited, deferring remaining jobs`)

          // Defer this job and all remaining
          await supabase
            .from('market_jobs')
            .update({
              status: 'deferred',
              completed_at: nowUtc(),
            })
            .eq('id', job.id)

          result.deferred++
          result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited' })

          // Defer remaining jobs
          const remaining = jobs.slice(jobs.indexOf(job) + 1)
          for (const remainingJob of remaining) {
            await supabase
              .from('market_jobs')
              .update({ status: 'pending', started_at: null })
              .eq('id', remainingJob.id)

            result.deferred++
            result.details.push({ jobId: remainingJob.id, status: 'deferred', message: 'Batch rate limited' })
          }

          break
        }
        throw new Error(`Search failed: ${error.message}`)
      }

      if (!products || products.length === 0) {
        throw new Error('Product not found')
      }

      const product = products[0]

      // WHY: Cache product metadata (brand, model, colorway) to ensure UI always has fallback data
      // Use directive-compliant fields from StockxProduct
      const brand = product.brand || extractBrandFromTitle(product.productName)
      const model = product.productName || job.sku
      const colorway = product.colorway || null

      // Upsert product catalog data with metadata
      await upsertProductCatalog({
        sku: job.sku,
        brand: brand || 'Unknown',
        model: model,
        colorway: colorway,
        image_url: product.image || constructImageUrl(job.sku),
        provider: 'stockx',
      })

      // PHASE 3.6: Also populate stockx_products table (required for snapshots)
      await upsertStockxProduct({
        stockxProductId: product.productId,
        brand: brand || 'Unknown',
        title: product.productName || null,
        colorway: colorway,
        imageUrl: product.image || constructImageUrl(job.sku),
        styleId: job.sku,
      })

      // If job has size, fetch variant market data
      if (job.size) {
        await sleep(DELAY_MS)

        // 2. Get variants using StockxCatalogService
        let variants
        try {
          variants = await catalogService.getProductVariants(product.productId)
        } catch (error: any) {
          if (error.message?.includes('429')) {
            await supabase
              .from('market_jobs')
              .update({ status: 'deferred', completed_at: nowUtc() })
              .eq('id', job.id)

            result.deferred++
            result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited on variants' })
            continue
          }
          throw new Error(`Variants failed: ${error.message}`)
        }

        // Match size using variantValue field (directive-compliant)
        const variant = variants.find((v) => String(v.variantValue) === job.size)

        if (!variant) {
          throw new Error(`Size ${job.size} not found`)
        }

        // PHASE 3.6: Populate stockx_variants table (required for snapshots)
        await upsertStockxVariant({
          stockxVariantId: variant.variantId,
          stockxProductId: product.productId,
          size: variant.variantValue || null,
          sizeDisplay: variant.variantValue || null,
          variantValue: variant.variantValue || null,
        })

        await sleep(DELAY_MS)

        // 3. Get market data using StockxMarketService
        let marketData
        try {
          marketData = await StockxMarketService.getVariantMarketData(
            product.productId,
            variant.variantId,
            currencyCode,
            job.user_id || undefined
          )
        } catch (error: any) {
          if (error.message?.includes('429')) {
            await supabase
              .from('market_jobs')
              .update({ status: 'deferred', completed_at: nowUtc() })
              .eq('id', job.id)

            result.deferred++
            result.details.push({ jobId: job.id, status: 'deferred', message: 'Rate limited on market data' })
            continue
          }
          throw new Error(`Market data failed: ${error.message}`)
        }

        // PHASE 3.5: Write to stockx_market_snapshots (CORRECT TABLE)
        await upsertMarketSnapshot({
          stockxProductId: product.productId,
          stockxVariantId: variant.variantId,
          currencyCode,
          lowestAsk: marketData.lowestAsk,
          highestBid: marketData.highestBid,
          salesLast72h: marketData.salesLast72h,
          totalVolume: marketData.volume30d,
        })

        // Debug logging for currency handling (DEV only)
        // Market price = highest_bid ?? lowest_ask ?? null
        const symbol = currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'
        const displayPrice = marketData.highestBid ?? marketData.lowestAsk
        console.log(`[StockX Worker ${runId}] ✓ ${job.sku}:${job.size} - ${symbol}${displayPrice} (${currencyCode})`)

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[StockX Worker ${runId}] Currency Debug:`, {
            sku: job.sku,
            source: 'stockx',
            price: marketData.highestBid ?? marketData.lowestAsk,
            currency: currencyCode,
            userCurrency: currencyCode,
            requestedCurrency: currencyCode
          })
        }
      }

      // Mark job as done
      await supabase
        .from('market_jobs')
        .update({
          status: 'done',
          completed_at: nowUtc(),
        })
        .eq('id', job.id)

      result.succeeded++
      result.details.push({ jobId: job.id, status: 'done' })

      // Rate limit between jobs
      if (jobs.indexOf(job) < jobs.length - 1) {
        await sleep(DELAY_MS)
      }

    } catch (error) {
      console.error(`[StockX Worker ${runId}] ✗ ${job.sku}:`, error)

      // Mark job as failed
      await supabase
        .from('market_jobs')
        .update({
          status: 'failed',
          completed_at: nowUtc(),
          error_message: String(error),
          retry_count: supabase.rpc('increment', { row_id: job.id }),
        })
        .eq('id', job.id)

      result.failed++
      result.details.push({ jobId: job.id, status: 'failed', message: String(error) })
    }
  }

  console.log(`[StockX Worker ${runId}] Completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.deferred} deferred`)

  // PHASE 3.5: Refresh materialized view after batch completes
  if (result.succeeded > 0) {
    console.log('[StockX Worker] Refreshing stockx_market_latest view...')
    await refreshStockxMarketLatestView({ dryRun: false })
    console.log('[StockX Worker] View refreshed - market data now visible in portfolio')
  }

  return result
}

// DEBUG: Inventory IDs for deep-dive instrumentation (Phase 3.x)
const DEBUG_INVENTORY_IDS = [
  '3c386636-f732-401e-9d78-201f36a217f2',
  'b732c556-687e-431f-9173-e9bfe0f02c8b',
  'bb656212-4ee2-4e74-961a-94a33d56aeda',
  '729d9d3d-b9e2-4f1e-8286-e235624b2923',
  '85a1fbbd-b271-4961-b65b-4d862ec2ac23',
]

/**
 * Sync a single inventory item with StockX
 *
 * DIRECTIVE COMPLIANT:
 * - Reads from DB (Inventory, inventory_market_links, stockx_*)
 * - Calls StockX V2 services if needed (StockxCatalogService, StockxMarketService)
 * - Writes to DB (worker layer only, not service files)
 * - Returns structured result
 *
 * WHY: Single orchestrator function for inventory item sync
 * Used by: POST /api/stockx/sync/item
 *
 * PHASE 3.x DEBUG: For specific problematic inventory IDs, returns detailed debug object
 */
export async function syncSingleInventoryItemFromStockx(params: {
  inventoryItemId: string
  userId: string
}): Promise<{
  itemId: string
  stockx: {
    productId: string | null
    variantId: string | null
    listingId: string | null
  }
  market: {
    currenciesProcessed: string[]
    snapshotsCreated: number
  }
  error?: string
  debug?: {
    isDebugItem: boolean
    v2ApiCalled: boolean
    v2ApiSuccess: boolean
    v2ApiError?: string
    allVariantsReturned: number
    mappedVariantFound: boolean
    mappedVariantId: string | null
    rawMarketData?: {
      lowestAsk: number | null
      highestBid: number | null
      salesLast72h: number | null
    }
    snapshotTableUsed: string
    snapshotCreationAttempted: boolean
    snapshotCreationSuccess: boolean
    skipReason?: string
  }
}> {
  const supabase = createClient()

  console.log(`[StockX Item Sync] Starting sync for item ${params.inventoryItemId}`)

  // PHASE 3.x DEBUG: Initialize debug tracking for problematic items
  const isDebugItem = DEBUG_INVENTORY_IDS.includes(params.inventoryItemId)
  const debugInfo = isDebugItem
    ? {
        isDebugItem: true,
        v2ApiCalled: false,
        v2ApiSuccess: false,
        v2ApiError: undefined as string | undefined,
        allVariantsReturned: 0,
        mappedVariantFound: false,
        mappedVariantId: null as string | null,
        rawMarketData: undefined as { lowestAsk: number | null; highestBid: number | null; salesLast72h: number | null } | undefined,
        snapshotTableUsed: 'stockx_market_prices', // Current table used by upsertMarketPriceIfStale
        snapshotCreationAttempted: false,
        snapshotCreationSuccess: false,
        skipReason: undefined as string | undefined,
      }
    : null

  if (isDebugItem) {
    console.log(`[DEBUG] 🔍 Tracking problematic item: ${params.inventoryItemId}`)
  }

  try {
    // 1. Read inventory item
    const { data: item, error: itemError } = await supabase
      .from('Inventory')
      .select('id, sku, size, brand, model, user_id')
      .eq('id', params.inventoryItemId)
      .eq('user_id', params.userId) // Ownership check
      .single()

    if (itemError || !item) {
      return {
        itemId: params.inventoryItemId,
        stockx: { productId: null, variantId: null, listingId: null },
        market: { currenciesProcessed: [], snapshotsCreated: 0 },
        error: `Inventory item not found or access denied: ${params.inventoryItemId}`,
      }
    }

    if (!item.sku) {
      return {
        itemId: params.inventoryItemId,
        stockx: { productId: null, variantId: null, listingId: null },
        market: { currenciesProcessed: [], snapshotsCreated: 0 },
        error: `Inventory item ${params.inventoryItemId} has no SKU`,
      }
    }

  console.log(`[StockX Item Sync] Item: ${item.sku}${item.size ? `:${item.size}` : ''}`)

  // 2. Read inventory_market_links to get mapping
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, stockx_listing_id')
    .eq('item_id', params.inventoryItemId)
    .maybeSingle()

  const result = {
    itemId: params.inventoryItemId,
    stockx: {
      productId: link?.stockx_product_id || null,
      variantId: link?.stockx_variant_id || null,
      listingId: link?.stockx_listing_id || null,
    },
    market: {
      currenciesProcessed: [] as string[],
      snapshotsCreated: 0,
    },
  }

  // If no StockX mapping, return gracefully (don't auto-find)
  if (!link || !link.stockx_product_id) {
    console.log(`[StockX Item Sync] No StockX mapping for item ${params.inventoryItemId}`)
    return result
  }

  const productId = link.stockx_product_id
  const variantId = link.stockx_variant_id

  // 3. Check if catalog is hydrated
  const { data: existingProduct } = await supabase
    .from('stockx_products')
    .select('id, brand, model, colorway, image_url')
    .eq('stockx_product_id', productId)
    .maybeSingle()

  // If catalog not hydrated, fetch from StockX V2
  if (!existingProduct) {
    console.log(`[StockX Item Sync] Fetching catalog data for product ${productId}`)

    const catalogService = new StockxCatalogService(params.userId)

    // Search for product
    const products = await catalogService.searchProducts(item.sku, { limit: 1 })

    if (!products || products.length === 0) {
      console.log(`[StockX Item Sync] Product not found on StockX for SKU ${item.sku}`)
      return result
    }

    const product = products[0]

    // Upsert catalog data
    const brand = product.brand || extractBrandFromTitle(product.productName)
    const model = product.productName || item.sku

    await upsertProductCatalog({
      sku: item.sku,
      brand: brand || 'Unknown',
      model: model,
      colorway: product.colorway || null,
      image_url: product.image || constructImageUrl(item.sku),
      provider: 'stockx',
    })

    // PHASE 3.6: Also populate stockx_products table (required for snapshots)
    await upsertStockxProduct({
      stockxProductId: productId,
      brand: brand || 'Unknown',
      title: product.productName || null,
      colorway: product.colorway || null,
      imageUrl: product.image || constructImageUrl(item.sku),
      styleId: item.sku,
    })

    console.log(`[StockX Item Sync] Catalog data hydrated for ${item.sku}`)
  }

  // 4. Fetch fresh market data if variantId is available
  if (variantId && item.size) {
    console.log(`[StockX Item Sync] Fetching market data for variant ${variantId}`)

    if (debugInfo) {
      debugInfo.mappedVariantId = variantId
    }

    // PHASE 3.6: Ensure variant record exists in stockx_variants table
    const { data: existingVariant } = await supabase
      .from('stockx_variants')
      .select('id')
      .eq('stockx_variant_id', variantId)
      .maybeSingle()

    if (!existingVariant) {
      console.log(`[StockX Item Sync] Populating variant ${variantId} in stockx_variants table`)

      // Fetch variant details from StockX
      const catalogService = new StockxCatalogService(params.userId)
      const variants = await catalogService.getProductVariants(productId)
      const variant = variants.find((v) => v.variantId === variantId)

      if (variant) {
        await upsertStockxVariant({
          stockxVariantId: variantId,
          stockxProductId: productId,
          size: variant.variantValue || null,
          sizeDisplay: variant.variantValue || null,
          variantValue: variant.variantValue || null,
        })
        console.log(`[StockX Item Sync] Variant ${variantId} populated`)
      } else {
        console.error(`[StockX Item Sync] Variant ${variantId} not found in StockX catalog`)
      }
    }

    // Get user's currency preference
    const { data: profile } = await supabase
      .from('profiles')
      .select('base_currency')
      .eq('id', params.userId)
      .single()

    const currencyCode = profile?.base_currency || 'GBP'

    // PHASE 3.x DEBUG: For debug items, also fetch ALL variants to compare
    if (debugInfo) {
      debugInfo.v2ApiCalled = true
      console.log(`[DEBUG] 📞 Calling StockX V2 API for product ${productId} (${currencyCode})`)

      try {
        // Fetch ALL variants to see what StockX returns
        const allVariants = await StockxMarketService.getProductMarketData(
          productId,
          currencyCode,
          params.userId
        )
        debugInfo.allVariantsReturned = allVariants.length
        debugInfo.v2ApiSuccess = true

        console.log(`[DEBUG] ✅ V2 API returned ${allVariants.length} variants`)
        console.log(`[DEBUG] Looking for mapped variant: ${variantId}`)

        // Check if our mapped variant exists in the response
        const matchedVariant = allVariants.find((v) => v.variantId === variantId)
        debugInfo.mappedVariantFound = !!matchedVariant

        if (matchedVariant) {
          debugInfo.rawMarketData = {
            lowestAsk: matchedVariant.lowestAsk,
            highestBid: matchedVariant.highestBid,
            salesLast72h: matchedVariant.salesLast72h,
          }
          console.log(`[DEBUG] ✅ Variant FOUND in V2 response:`, {
            variantId: matchedVariant.variantId,
            variantValue: matchedVariant.variantValue,
            lowestAsk: matchedVariant.lowestAsk,
            highestBid: matchedVariant.highestBid,
          })
        } else {
          debugInfo.skipReason = `Mapped variant ${variantId} not found in V2 response. Available variants: ${allVariants.map((v) => v.variantId).join(', ')}`
          console.log(`[DEBUG] ❌ Variant NOT FOUND in V2 response`)
          console.log(`[DEBUG] Available variants:`, allVariants.map((v) => ({
            id: v.variantId,
            value: v.variantValue,
            lowestAsk: v.lowestAsk,
            highestBid: v.highestBid,
          })))
        }
      } catch (debugError: any) {
        debugInfo.v2ApiSuccess = false
        debugInfo.v2ApiError = debugError.message
        console.log(`[DEBUG] ❌ V2 API call failed:`, debugError.message)
      }
    }

    // PHASE 3.11: Wrap market data fetch in try-catch to detect 404s
    let marketData
    try {
      marketData = await StockxMarketService.getVariantMarketData(
        productId,
        variantId,
        currencyCode,
        params.userId
      )
    } catch (error: any) {
      // PHASE 3.11: Detect 404 errors (invalid StockX product mapping)
      const is404 = error.status === 404 ||
                    error.statusCode === 404 ||
                    error.message?.includes('404') ||
                    error.message?.includes('not found') ||
                    error.message?.includes('Resource not found')

      if (is404) {
        console.error(`[PHASE 3.11] StockX product ${productId} returned 404 - mapping is invalid`)

        // Update inventory_market_links to mark mapping as invalid
        await supabase
          .from('inventory_market_links')
          .update({
            mapping_status: 'stockx_404',
            last_sync_error: `StockX API returned 404 - product not found (productId: ${productId})`,
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', params.inventoryItemId)

        console.error(`[PHASE 3.11] Updated mapping status to 'stockx_404' for item ${params.inventoryItemId}`)

        // Return error result with explicit 404 status
        return {
          itemId: params.inventoryItemId,
          stockx: {
            productId,
            variantId,
            listingId: null,
          },
          market: {
            currenciesProcessed: [],
            snapshotsCreated: 0,
          },
          error: `StockX product mapping is invalid (404). Product ${productId} not found on StockX. Run remap script to fix.`,
        }
      }

      // If not a 404, re-throw the error
      throw error
    }

    // PHASE 3.5: Write to stockx_market_snapshots (CORRECT TABLE)
    if (debugInfo) {
      debugInfo.snapshotCreationAttempted = true
      debugInfo.snapshotTableUsed = 'stockx_market_snapshots'
      console.log(`[DEBUG] 💾 Writing to: ${debugInfo.snapshotTableUsed}`)
    }

    const snapshotCreated = await upsertMarketSnapshot({
      stockxProductId: productId,
      stockxVariantId: variantId,
      currencyCode,
      lowestAsk: marketData.lowestAsk,
      highestBid: marketData.highestBid,
      salesLast72h: marketData.salesLast72h,
      totalVolume: marketData.volume30d,
    })

    if (debugInfo) {
      debugInfo.snapshotCreationSuccess = snapshotCreated
      console.log(`[DEBUG] ${snapshotCreated ? '✅' : '❌'} Snapshot ${snapshotCreated ? 'created' : 'failed'}`)
      if (!snapshotCreated && !debugInfo.skipReason) {
        debugInfo.skipReason = 'Snapshot creation failed - check product/variant UUIDs exist in stockx_products/stockx_variants tables'
      }
    }

    // PHASE 3.11: Update mapping as successful (status='ok') on successful API call
    await supabase
      .from('inventory_market_links')
      .update({
        mapping_status: 'ok',
        last_sync_success_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', params.inventoryItemId)

    result.market.currenciesProcessed.push(currencyCode)
    result.market.snapshotsCreated = snapshotCreated ? 1 : 0

    // PHASE 3.5: Refresh materialized view after successful snapshot
    if (snapshotCreated) {
      console.log('[StockX Item Sync] Refreshing stockx_market_latest view...')
      await refreshStockxMarketLatestView({ dryRun: false })
      console.log('[StockX Item Sync] View refreshed - market data now visible in portfolio')
    }

    console.log(`[StockX Item Sync] Market data synced for ${item.sku}:${item.size} (${currencyCode})`)
  } else if (debugInfo && !variantId) {
    debugInfo.skipReason = 'No variantId in mapping - cannot fetch market data'
    console.log(`[DEBUG] ⚠️ Skipping market data fetch: no variantId mapped`)
  } else if (debugInfo && !item.size) {
    debugInfo.skipReason = 'No size in inventory item - cannot fetch variant market data'
    console.log(`[DEBUG] ⚠️ Skipping market data fetch: no size in inventory`)
  }

    console.log(`[StockX Item Sync] Complete for item ${params.inventoryItemId}`)

    // PHASE 3.x DEBUG: Add debug info to result if this is a debug item
    if (debugInfo) {
      console.log(`[DEBUG] 📋 Final debug summary:`, debugInfo)
      return {
        ...result,
        debug: debugInfo,
      }
    }

    return result

  } catch (error: any) {
    const errorMessage = error.message || String(error)
    console.error(`[StockX Item Sync] Error syncing item ${params.inventoryItemId}:`, errorMessage)

    // PHASE 3.x DEBUG: Include debug info in error response
    const errorResult = {
      itemId: params.inventoryItemId,
      stockx: { productId: null, variantId: null, listingId: null },
      market: { currenciesProcessed: [], snapshotsCreated: 0 },
      error: errorMessage,
    }

    if (debugInfo) {
      if (!debugInfo.v2ApiError) {
        debugInfo.v2ApiError = errorMessage
      }
      console.log(`[DEBUG] ❌ Sync failed - debug info:`, debugInfo)
      return {
        ...errorResult,
        debug: debugInfo,
      }
    }

    return errorResult
  }
}

/**
 * Sync all inventory items for a user with StockX
 *
 * DIRECTIVE COMPLIANT:
 * - Reads from DB (Inventory, inventory_market_links)
 * - Calls syncSingleInventoryItemFromStockx for each item
 * - Supports pagination for large inventories
 * - Implements rate limiting between items
 * - Returns detailed sync report
 *
 * WHY: Bulk sync operation for refreshing all StockX data
 * Used by: POST /api/stockx/sync/inventory
 */
export async function syncAllInventoryItemsFromStockx(params: {
  userId: string
  mode?: 'mapped-only' | 'auto-discover'
  limit?: number
  cursor?: string | null
  dryRun?: boolean
}): Promise<{
  userId: string
  mode: 'mapped-only' | 'auto-discover'
  limit: number
  cursor: string | null
  nextCursor: string | null
  totalItemsScanned: number
  totalItemsSynced: number
  totalItemsSkipped: number
  totalErrors: number
  items: Array<{
    inventoryItemId: string
    status: 'synced' | 'skipped' | 'error'
    reason?: string
    mappingExists: boolean
  }>
  error?: string
}> {
  const supabase = createClient()

  // Apply defaults
  const mode = params.mode || 'mapped-only'
  const limit = Math.min(params.limit || 100, 250) // Max 250 items per run
  const dryRun = params.dryRun || false

  console.log(`[StockX Bulk Sync] Starting for user ${params.userId}`, {
    mode,
    limit,
    cursor: params.cursor,
    dryRun,
  })

  const result = {
    userId: params.userId,
    mode,
    limit,
    cursor: params.cursor || null,
    nextCursor: null as string | null,
    totalItemsScanned: 0,
    totalItemsSynced: 0,
    totalItemsSkipped: 0,
    totalErrors: 0,
    items: [] as Array<{
      inventoryItemId: string
      status: 'synced' | 'skipped' | 'error'
      reason?: string
      mappingExists: boolean
    }>,
  }

  try {
    // ========================================================================
    // 1. FETCH INVENTORY ITEMS (PAGINATED)
    // ========================================================================

    // Use offset-based pagination for simplicity
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0

    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id, sku, size, brand, model')
      .eq('user_id', params.userId)
      .in('status', ['active', 'listed', 'worn'])
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (inventoryError) {
      return {
        ...result,
        error: `Failed to fetch inventory: ${inventoryError.message}`,
      }
    }

  if (!inventoryItems || inventoryItems.length === 0) {
    console.log(`[StockX Bulk Sync] No items found for user ${params.userId}`)
    return result
  }

  result.totalItemsScanned = inventoryItems.length

  // Calculate next cursor
  if (inventoryItems.length === limit) {
    // There might be more items, set next cursor
    result.nextCursor = String(offset + limit)
  }

  console.log(`[StockX Bulk Sync] Processing ${inventoryItems.length} items (offset: ${offset})`)

  // ========================================================================
  // 2. FETCH MAPPINGS FOR FILTERED ITEMS (MODE: 'mapped-only')
  // ========================================================================

  let itemsToSync = inventoryItems
  const mappingMap = new Map<string, boolean>()

  if (mode === 'mapped-only') {
    // Fetch mappings for all items in this batch
    const { data: mappings } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id')
      .in('item_id', inventoryItems.map(i => i.id))

    if (mappings) {
      mappings.forEach(m => {
        if (m.stockx_product_id) {
          mappingMap.set(m.item_id, true)
        }
      })
    }

    // Filter to only items with mappings
    itemsToSync = inventoryItems.filter(item => mappingMap.has(item.id))

    console.log(`[StockX Bulk Sync] Filtered to ${itemsToSync.length} items with StockX mappings`)
  } else if (mode === 'auto-discover') {
    // FUTURE: Auto-discovery would search StockX for unmapped items
    // For now, treat same as 'mapped-only'
    // TODO: Implement auto-discovery via StockxCatalogService.searchProducts()
    console.log(`[StockX Bulk Sync] Auto-discover mode not yet implemented, using mapped-only`)

    const { data: mappings } = await supabase
      .from('inventory_market_links')
      .select('item_id, stockx_product_id')
      .in('item_id', inventoryItems.map(i => i.id))

    if (mappings) {
      mappings.forEach(m => {
        if (m.stockx_product_id) {
          mappingMap.set(m.item_id, true)
        }
      })
    }

    itemsToSync = inventoryItems.filter(item => mappingMap.has(item.id))
  }

  // ========================================================================
  // 3. SYNC EACH ITEM
  // ========================================================================

  for (const item of inventoryItems) {
    const hasMappingExists = mappingMap.has(item.id)

    // Skip items without mappings in 'mapped-only' mode
    if (mode === 'mapped-only' && !hasMappingExists) {
      result.totalItemsSkipped++
      result.items.push({
        inventoryItemId: item.id,
        status: 'skipped',
        reason: 'No StockX mapping',
        mappingExists: false,
      })
      continue
    }

    // DRY RUN: Simulate sync without actual DB writes
    if (dryRun) {
      result.totalItemsSynced++
      result.items.push({
        inventoryItemId: item.id,
        status: 'synced',
        reason: 'Dry run (simulated)',
        mappingExists: hasMappingExists,
      })
      continue
    }

    // ACTUAL SYNC: Call single-item sync
    try {
      await syncSingleInventoryItemFromStockx({
        inventoryItemId: item.id,
        userId: params.userId,
      })

      result.totalItemsSynced++
      result.items.push({
        inventoryItemId: item.id,
        status: 'synced',
        mappingExists: hasMappingExists,
      })

      console.log(`[StockX Bulk Sync] ✓ Synced ${item.sku}`)
    } catch (error: any) {
      result.totalErrors++
      result.items.push({
        inventoryItemId: item.id,
        status: 'error',
        reason: error.message || 'Unknown error',
        mappingExists: hasMappingExists,
      })

      console.error(`[StockX Bulk Sync] ✗ Failed to sync ${item.sku}:`, error.message)
    }

    // Rate limiting: 50ms delay between items
    if (inventoryItems.indexOf(item) < inventoryItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

    console.log(`[StockX Bulk Sync] Complete for user ${params.userId}:`, {
      scanned: result.totalItemsScanned,
      synced: result.totalItemsSynced,
      skipped: result.totalItemsSkipped,
      errors: result.totalErrors,
      hasMore: !!result.nextCursor,
    })

    return result

  } catch (error: any) {
    const errorMessage = error.message || String(error)
    console.error(`[StockX Bulk Sync] Error during bulk sync for user ${params.userId}:`, errorMessage)

    return {
      ...result,
      error: errorMessage,
    }
  }
}

/**
 * Rebuild sparkline daily medians from historical market snapshots
 *
 * DIRECTIVE COMPLIANT:
 * - NO StockX API calls (reads from stockx_market_snapshots only)
 * - Aggregates daily median prices per (sku, size, day)
 * - Writes to market_price_daily_medians table
 * - All amounts in major currency units
 *
 * WHY: Pre-compute sparkline data for portfolio graphs without live API calls
 * Used by: POST /api/stockx/sparkline/rebuild (manual/cron trigger)
 */
export async function rebuildSparklineDailyMedians(options?: {
  daysBack?: number
  currency?: 'USD' | 'GBP' | 'EUR'
  dryRun?: boolean
}): Promise<{
  success: boolean
  daysBack: number
  currency: string
  rowsScanned: number
  rowsWritten: number
  productsAffected: number
  variantsAffected: number
  errors: number
}> {
  const supabase = createClient()

  const daysBack = options?.daysBack || 365
  const currency = options?.currency || 'GBP'
  const dryRun = options?.dryRun || false

  console.log(`[Sparkline Rebuild] Starting rebuild`, {
    daysBack,
    currency,
    dryRun,
  })

  const result = {
    success: false,
    daysBack,
    currency,
    rowsScanned: 0,
    rowsWritten: 0,
    productsAffected: 0,
    variantsAffected: 0,
    errors: 0,
  }

  try {
    // ========================================================================
    // 1. QUERY RAW SNAPSHOTS WITH PRODUCT/VARIANT JOIN
    // ========================================================================

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)
    const cutoffIso = cutoffDate.toISOString()

    console.log(`[Sparkline Rebuild] Fetching snapshots since ${cutoffIso}`)

    // Fetch snapshots with product and variant data
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('stockx_market_snapshots')
      .select(`
        snapshot_at,
        currency_code,
        lowest_ask,
        stockx_product_id,
        stockx_variant_id
      `)
      .eq('currency_code', currency)
      .gte('snapshot_at', cutoffIso)

    if (snapshotsError) {
      throw new Error(`Failed to fetch snapshots: ${snapshotsError.message}`)
    }

    if (!snapshots || snapshots.length === 0) {
      console.log(`[Sparkline Rebuild] No snapshots found for ${currency} in last ${daysBack} days`)
      result.success = true
      return result
    }

    result.rowsScanned = snapshots.length
    console.log(`[Sparkline Rebuild] Found ${snapshots.length} snapshots`)

    // ========================================================================
    // 2. FETCH PRODUCT AND VARIANT METADATA
    // ========================================================================

    const productIds = [...new Set(snapshots.map(s => s.stockx_product_id))]
    const variantIds = [...new Set(snapshots.map(s => s.stockx_variant_id).filter(Boolean))]

    console.log(`[Sparkline Rebuild] Fetching metadata for ${productIds.length} products, ${variantIds.length} variants`)

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('stockx_products')
      .select('stockx_product_id, style_id')
      .in('stockx_product_id', productIds)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    // Fetch variants
    const { data: variants, error: variantsError } = await supabase
      .from('stockx_variants')
      .select('stockx_variant_id, variant_value')
      .in('stockx_variant_id', variantIds)

    if (variantsError) {
      throw new Error(`Failed to fetch variants: ${variantsError.message}`)
    }

    // Build lookup maps
    const productMap = new Map<string, string>()
    if (products) {
      products.forEach(p => {
        productMap.set(p.stockx_product_id, p.style_id)
      })
    }

    const variantMap = new Map<string, string>()
    if (variants) {
      variants.forEach(v => {
        variantMap.set(v.stockx_variant_id, v.variant_value)
      })
    }

    // ========================================================================
    // 3. AGGREGATE BY (SKU, SIZE_UK, DAY)
    // ========================================================================

    console.log(`[Sparkline Rebuild] Aggregating daily medians`)

    // Group snapshots by (sku, size_uk, day)
    const dailyGroups = new Map<string, number[]>()

    for (const snapshot of snapshots) {
      const sku = productMap.get(snapshot.stockx_product_id)
      if (!sku) {
        result.errors++
        continue
      }

      // Size mapping: variant_value → size_uk
      // NOTE: Assumes stockx_variants.variant_value is UK size format
      const size_uk = snapshot.stockx_variant_id
        ? variantMap.get(snapshot.stockx_variant_id) || ''
        : ''

      // Day truncation (YYYY-MM-DD)
      const day = snapshot.snapshot_at.split('T')[0]

      // Price selection: lowest_ask
      const price = snapshot.lowest_ask
      if (!price) continue // Skip if no price available

      // Group key
      const key = `${sku}:${size_uk}:${day}`

      if (!dailyGroups.has(key)) {
        dailyGroups.set(key, [])
      }
      dailyGroups.get(key)!.push(price)
    }

    console.log(`[Sparkline Rebuild] Computed ${dailyGroups.size} daily median groups`)

    // ========================================================================
    // 4. COMPUTE MEDIANS AND PREPARE UPSERTS
    // ========================================================================

    const medianRows: Array<{
      sku: string
      size_uk: string
      day: string
      median: number
    }> = []

    const affectedProducts = new Set<string>()
    const affectedVariants = new Set<string>()

    for (const [key, prices] of dailyGroups.entries()) {
      const [sku, size_uk, day] = key.split(':')

      // Calculate median
      const sorted = prices.sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]

      medianRows.push({
        sku,
        size_uk: size_uk || '',
        day,
        median,
      })

      affectedProducts.add(sku)
      if (size_uk) affectedVariants.add(`${sku}:${size_uk}`)
    }

    result.productsAffected = affectedProducts.size
    result.variantsAffected = affectedVariants.size

    console.log(`[Sparkline Rebuild] Prepared ${medianRows.length} median rows`)

    // ========================================================================
    // 5. UPSERT INTO market_price_daily_medians
    // ========================================================================

    if (dryRun) {
      console.log(`[Sparkline Rebuild] DRY RUN: Would write ${medianRows.length} rows`)
      result.rowsWritten = medianRows.length
      result.success = true
      return result
    }

    // Batch upsert (Supabase limits to ~1000 rows per request)
    const batchSize = 500
    let totalWritten = 0

    for (let i = 0; i < medianRows.length; i += batchSize) {
      const batch = medianRows.slice(i, i + batchSize)

      const { error: upsertError } = await supabase
        .from('market_price_daily_medians')
        .upsert(batch, {
          onConflict: 'sku,size_uk,day',
        })

      if (upsertError) {
        console.error(`[Sparkline Rebuild] Batch upsert failed:`, upsertError.message)
        result.errors++
      } else {
        totalWritten += batch.length
        console.log(`[Sparkline Rebuild] Wrote batch ${i / batchSize + 1} (${batch.length} rows)`)
      }
    }

    result.rowsWritten = totalWritten
    result.success = true

    console.log(`[Sparkline Rebuild] Complete:`, {
      rowsScanned: result.rowsScanned,
      rowsWritten: result.rowsWritten,
      productsAffected: result.productsAffected,
      variantsAffected: result.variantsAffected,
      errors: result.errors,
    })

    return result

  } catch (error: any) {
    const errorMessage = error.message || String(error)
    console.error(`[Sparkline Rebuild] Error:`, errorMessage)
    result.success = false
    result.errors++
    return result
  }
}

/**
 * Refresh stockx_market_latest materialized view
 *
 * DIRECTIVE COMPLIANT:
 * - NO StockX API calls (refreshes DB view only)
 * - Calls Postgres RPC to refresh materialized view
 * - View aggregates latest snapshot per (product, variant, currency)
 *
 * WHY: Ensure stockx_market_latest is up-to-date for UI queries
 * Used by: POST /api/cron/stockx/refresh-latest (cron trigger)
 */
export async function refreshStockxMarketLatestView(options?: {
  dryRun?: boolean
}): Promise<{
  success: boolean
  dryRun: boolean
  refreshed: boolean
  error?: string
  warning?: string
  durationMs?: number
}> {
  const supabase = createClient()
  const dryRun = options?.dryRun || false
  const startTime = Date.now()

  console.log(`[MV Refresh] Starting stockx_market_latest refresh`, { dryRun })

  try {
    if (dryRun) {
      console.log(`[MV Refresh] DRY RUN: Would call refresh_stockx_market_latest RPC`)
      return {
        success: true,
        dryRun: true,
        refreshed: false,
      }
    }

    // Call Postgres RPC to refresh materialized view
    const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

    if (refreshError) {
      // PGRST200 = function not found in schema cache
      // This happens when the refresh function migration hasn't been applied yet
      if (refreshError.code === 'PGRST200' || refreshError.message?.includes('Could not find the function')) {
        console.warn(`[MV Refresh] ⚠️  Refresh function not found - skipping view refresh`)
        console.warn(`[MV Refresh] To enable automatic refresh, apply migration: supabase/migrations/20251120_create_refresh_function.sql`)
        return {
          success: true, // Don't fail the entire batch just because refresh is missing
          dryRun: false,
          refreshed: false,
          warning: 'Refresh function not found - data written but view not refreshed',
          durationMs: Date.now() - startTime,
        }
      }

      // 42809 = CONCURRENT refresh failed (likely missing unique index or it's a regular view)
      // This is OK - the view still exists and has data
      if (refreshError.code === '42809' || refreshError.message?.includes('is not a table or materialized view')) {
        console.warn(`[MV Refresh] ⚠️  CONCURRENT refresh not supported - view may be a regular view or missing unique index`)
        console.warn(`[MV Refresh] Data is being written correctly to stockx_market_snapshots`)
        return {
          success: true, // Don't fail - data was written successfully
          dryRun: false,
          refreshed: false,
          warning: 'View refresh skipped - data written successfully to snapshots table',
          durationMs: Date.now() - startTime,
        }
      }

      console.error(`[MV Refresh] Failed to refresh view:`, refreshError.message)
      return {
        success: false,
        dryRun: false,
        refreshed: false,
        error: refreshError.message,
        durationMs: Date.now() - startTime,
      }
    }

    const duration = Date.now() - startTime
    console.log(`[MV Refresh] Successfully refreshed stockx_market_latest in ${duration}ms`)

    return {
      success: true,
      dryRun: false,
      refreshed: true,
      durationMs: duration,
    }

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[MV Refresh] Error:`, error.message)

    return {
      success: false,
      dryRun: false,
      refreshed: false,
      error: error.message || 'Unknown error',
      durationMs: duration,
    }
  }
}

/**
 * Construct StockX CDN image URL from SKU
 */
function constructImageUrl(sku: string): string | null {
  if (!sku) return null
  return `https://images.stockx.com/images/${sku}.jpg`
}

/**
 * Extract brand from product title as fallback
 * e.g. "Nike Dunk Low White Black" → "Nike"
 */
function extractBrandFromTitle(title?: string): string | null {
  if (!title) return null

  const knownBrands = ['Nike', 'Adidas', 'Jordan', 'Yeezy', 'New Balance', 'Asics', 'Puma', 'Reebok', 'Vans', 'Converse']
  const firstWord = title.split(' ')[0]

  // Check if first word matches a known brand (case-insensitive)
  const matchedBrand = knownBrands.find(brand => brand.toLowerCase() === firstWord.toLowerCase())

  return matchedBrand || firstWord
}
