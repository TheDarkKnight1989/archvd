/**
 * Inngest Sync Functions
 * Production-grade background jobs for market data sync with concurrency control
 */

import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import { syncProductAllRegions } from '@/lib/services/stockx/market-refresh'
import { createAliasClient } from '@/lib/services/alias/client'
import { syncAliasProductMultiRegion } from '@/lib/services/alias/sync'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// Sync Single Product (both Alias and StockX)
// ============================================================================

export const syncProduct = inngest.createFunction(
  {
    id: 'sync-product',
    name: 'Sync Product Market Data',
    concurrency: {
      limit: 10, // Process max 10 products at a time to avoid rate limits
    },
    retries: 3,
  },
  { event: 'product/sync' },
  async ({ event, step }) => {
    const { sku, stockxProductId, aliasCatalogId } = event.data

    console.log(`[Inngest] Syncing product: ${sku}`)

    let aliasSuccess = false
    let stockxSuccess = false
    let aliasSnapshots = 0
    let stockxSnapshots = 0

    // ========================================================================
    // STEP 1: Sync Alias Data
    // ========================================================================

    if (aliasCatalogId) {
      const aliasResult = await step.run('sync-alias', async () => {
        try {
          console.log(`[Inngest] Syncing Alias for ${sku}...`)

          const aliasClient = createAliasClient()

          // Use production multi-region sync (handles all size mapping + ingestion properly)
          const result = await syncAliasProductMultiRegion(aliasClient, aliasCatalogId, {
            sku,
            userRegion: 'UK',
            syncSecondaryRegions: true
          })

          if (result.success) {
            console.log(`[Inngest] ✅ Alias sync complete: ${result.totalVariantsIngested} variants`)
            return { success: true, snapshots: result.totalVariantsIngested }
          } else {
            console.error(`[Inngest] ❌ Alias sync failed:`, result.primaryResult.error)
            return { success: false, snapshots: 0, error: result.primaryResult.error }
          }
        } catch (error: any) {
          console.error(`[Inngest] ❌ Alias sync failed:`, error.message)
          return { success: false, snapshots: 0, error: error.message }
        }
      })

      aliasSuccess = aliasResult.success
      aliasSnapshots = aliasResult.snapshots
    }

    // ========================================================================
    // STEP 2: Sync StockX Data
    // ========================================================================

    if (stockxProductId) {
      const stockxResult = await step.run('sync-stockx', async () => {
        try {
          console.log(`[Inngest] Syncing StockX for ${sku}...`)

          const result = await syncProductAllRegions(
            undefined,
            stockxProductId,
            'UK',
            false // Skip secondary regions initially to avoid rate limits
          )

          if (result.success) {
            console.log(
              `[Inngest] ✅ StockX sync complete: ${result.totalSnapshotsCreated} snapshots`
            )
            return {
              success: true,
              snapshots: result.totalSnapshotsCreated,
            }
          } else {
            console.error(`[Inngest] ❌ StockX sync failed:`, result.primaryResult.error)
            return {
              success: false,
              snapshots: 0,
              error: result.primaryResult.error,
            }
          }
        } catch (error: any) {
          console.error(`[Inngest] ❌ StockX sync error:`, error.message)
          return { success: false, snapshots: 0, error: error.message }
        }
      })

      stockxSuccess = stockxResult.success
      stockxSnapshots = stockxResult.snapshots
    }

    // ========================================================================
    // STEP 3: Update last_synced_at
    // ========================================================================

    if (aliasSuccess || stockxSuccess) {
      await step.run('update-last-synced', async () => {
        await supabase.from('products').update({ last_synced_at: new Date().toISOString() }).eq('sku', sku)
      })
    }

    // ========================================================================
    // Return Results
    // ========================================================================

    const totalSnapshots = aliasSnapshots + stockxSnapshots
    const overallSuccess = (aliasCatalogId ? aliasSuccess : true) && (stockxProductId ? stockxSuccess : true)

    console.log(
      `[Inngest] ${overallSuccess ? '✅' : '❌'} Product ${sku} sync ${
        overallSuccess ? 'complete' : 'failed'
      }: ${totalSnapshots} snapshots`
    )

    return {
      success: overallSuccess,
      sku,
      alias: {
        success: aliasSuccess,
        snapshots: aliasSnapshots,
      },
      stockx: {
        success: stockxSuccess,
        snapshots: stockxSnapshots,
      },
      totalSnapshots,
    }
  }
)

// ============================================================================
// Trigger Sync for All Products (fan-out pattern)
// ============================================================================

export const syncAllProducts = inngest.createFunction(
  {
    id: 'sync-all-products',
    name: 'Sync All Products',
  },
  { event: 'products/sync-all' },
  async ({ event, step }) => {
    console.log('[Inngest] Starting sync for all products...')

    // Get all products with StockX or Alias IDs
    const result = await step.run('fetch-products', async () => {
      const { data: allProducts, error } = await supabase
        .from('products')
        .select(
          `
          id,
          sku,
          brand,
          model,
          product_variants (
            alias_catalog_id,
            stockx_product_id
          )
        `
        )

      if (error || !allProducts) {
        throw new Error(`Failed to fetch products: ${error?.message}`)
      }

      // Filter products that have either Alias or StockX IDs
      const products = allProducts.filter((p) => {
        const variants = p.product_variants as any[]
        return variants && variants.some((v) => v.alias_catalog_id || v.stockx_product_id)
      })

      return { products, total: allProducts.length }
    })

    const { products } = result

    console.log(`[Inngest] Found ${products.length} products to sync (out of ${result.total} total)`)

    // Fan out: send individual sync events for each product
    // Inngest will handle concurrency control automatically
    const events = products.map((product) => {
      const variants = product.product_variants as any[]
      const aliasCatalogId = variants.find((v) => v.alias_catalog_id)?.alias_catalog_id
      const stockxProductId = variants.find((v) => v.stockx_product_id)?.stockx_product_id

      return {
        name: 'product/sync',
        data: {
          sku: product.sku,
          aliasCatalogId,
          stockxProductId,
        },
      }
    })

    await step.sendEvent('fan-out-sync', events)

    console.log(`[Inngest] ✅ Triggered sync for ${products.length} products`)

    return {
      success: true,
      productsTriggered: products.length,
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================================================
// Sync Single StockX Product (All Regions)
// ============================================================================

export const syncStockXProductAllRegions = inngest.createFunction(
  {
    id: 'sync-stockx-product-all-regions',
    name: 'Sync StockX Product (US, UK, EU)',
    concurrency: {
      limit: 10, // Process max 10 products at a time
    },
    retries: 2, // Retry failed products twice
  },
  { event: 'stockx/sync-product-all-regions' },
  async ({ event, step }) => {
    const { stockxProductId, sku, brand } = event.data

    console.log(`[Inngest StockX] Syncing ${sku} across all regions...`)

    const regionResults = {
      US: { success: false, snapshots: 0, error: null as string | null, timeout: false },
      UK: { success: false, snapshots: 0, error: null as string | null, timeout: false },
      EU: { success: false, snapshots: 0, error: null as string | null, timeout: false },
    }

    // ========================================================================
    // STEP 1: Sync US Region
    // ========================================================================

    const usResult = await step.run('sync-us-region', async () => {
      try {
        console.log(`[Inngest StockX] 🇺🇸 Syncing US region for ${sku}...`)
        const result = await syncProductAllRegions(
          undefined,
          stockxProductId,
          'US',
          false // Don't auto-sync other regions
        )

        if (result.success) {
          console.log(`[Inngest StockX] ✅ US: ${result.primaryResult.snapshotsCreated} snapshots`)
          return { success: true, snapshots: result.primaryResult.snapshotsCreated }
        } else {
          const isTimeout = result.primaryResult.error?.includes('504') ||
                           result.primaryResult.error?.includes('timeout')
          console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} US failed: ${result.primaryResult.error}`)
          return {
            success: false,
            snapshots: 0,
            error: result.primaryResult.error || 'Unknown error',
            timeout: isTimeout
          }
        }
      } catch (error: any) {
        const isTimeout = error.message?.includes('504') || error.message?.includes('timeout')
        console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} US error: ${error.message}`)
        return { success: false, snapshots: 0, error: error.message, timeout: isTimeout }
      }
    })

    regionResults.US = usResult

    // Small delay between regions
    await step.sleep('delay-after-us', '2s')

    // ========================================================================
    // STEP 2: Sync UK Region
    // ========================================================================

    const ukResult = await step.run('sync-uk-region', async () => {
      try {
        console.log(`[Inngest StockX] 🇬🇧 Syncing UK region for ${sku}...`)
        const result = await syncProductAllRegions(
          undefined,
          stockxProductId,
          'UK',
          false
        )

        if (result.success) {
          console.log(`[Inngest StockX] ✅ UK: ${result.primaryResult.snapshotsCreated} snapshots`)
          return { success: true, snapshots: result.primaryResult.snapshotsCreated }
        } else {
          const isTimeout = result.primaryResult.error?.includes('504') ||
                           result.primaryResult.error?.includes('timeout')
          console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} UK failed: ${result.primaryResult.error}`)
          return {
            success: false,
            snapshots: 0,
            error: result.primaryResult.error || 'Unknown error',
            timeout: isTimeout
          }
        }
      } catch (error: any) {
        const isTimeout = error.message?.includes('504') || error.message?.includes('timeout')
        console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} UK error: ${error.message}`)
        return { success: false, snapshots: 0, error: error.message, timeout: isTimeout }
      }
    })

    regionResults.UK = ukResult

    await step.sleep('delay-after-uk', '2s')

    // ========================================================================
    // STEP 3: Sync EU Region
    // ========================================================================

    const euResult = await step.run('sync-eu-region', async () => {
      try {
        console.log(`[Inngest StockX] 🇪🇺 Syncing EU region for ${sku}...`)
        const result = await syncProductAllRegions(
          undefined,
          stockxProductId,
          'EU',
          false
        )

        if (result.success) {
          console.log(`[Inngest StockX] ✅ EU: ${result.primaryResult.snapshotsCreated} snapshots`)
          return { success: true, snapshots: result.primaryResult.snapshotsCreated }
        } else {
          const isTimeout = result.primaryResult.error?.includes('504') ||
                           result.primaryResult.error?.includes('timeout')
          console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} EU failed: ${result.primaryResult.error}`)
          return {
            success: false,
            snapshots: 0,
            error: result.primaryResult.error || 'Unknown error',
            timeout: isTimeout
          }
        }
      } catch (error: any) {
        const isTimeout = error.message?.includes('504') || error.message?.includes('timeout')
        console.error(`[Inngest StockX] ${isTimeout ? '⏱️' : '❌'} EU error: ${error.message}`)
        return { success: false, snapshots: 0, error: error.message, timeout: isTimeout }
      }
    })

    regionResults.EU = euResult

    // ========================================================================
    // Calculate Results
    // ========================================================================

    const totalSnapshots = regionResults.US.snapshots + regionResults.UK.snapshots + regionResults.EU.snapshots
    const overallSuccess = regionResults.US.success || regionResults.UK.success || regionResults.EU.success
    const allTimeouts = regionResults.US.timeout && regionResults.UK.timeout && regionResults.EU.timeout

    const status = allTimeouts ? '⏱️ ALL TIMEOUTS' :
                   overallSuccess ? '✅ SUCCESS' : '❌ FAILED'

    console.log(`[Inngest StockX] ${status} ${sku}: ${totalSnapshots} total snapshots`)

    return {
      success: overallSuccess,
      sku,
      brand,
      stockxProductId,
      totalSnapshots,
      allTimeouts,
      regionResults,
    }
  }
)

// ============================================================================
// Trigger StockX Sync for All Products (fan-out pattern)
// ============================================================================

export const syncAllStockXProducts = inngest.createFunction(
  {
    id: 'sync-all-stockx-products',
    name: 'Sync All StockX Products',
  },
  { event: 'stockx/sync-all' },
  async ({ event, step }) => {
    console.log('[Inngest StockX] Starting sync for all StockX products...')

    // Get all products from stockx_products table (correct source)
    const result = await step.run('fetch-stockx-products', async () => {
      const { data: products, error } = await supabase
        .from('stockx_products')
        .select('stockx_product_id, style_id, brand')
        .order('style_id')

      if (error || !products) {
        throw new Error(`Failed to fetch StockX products: ${error?.message}`)
      }

      return { products, total: products.length }
    })

    const { products } = result

    console.log(`[Inngest StockX] Found ${products.length} StockX products to sync`)

    // Fan out: send individual sync events for each product
    // Inngest will handle concurrency control automatically (10 at a time)
    const events = products.map((product) => ({
      name: 'stockx/sync-product-all-regions',
      data: {
        stockxProductId: product.stockx_product_id,
        sku: product.style_id,
        brand: product.brand || 'Unknown',
      },
    }))

    await step.sendEvent('fan-out-stockx-sync', events)

    console.log(`[Inngest StockX] ✅ Triggered sync for ${products.length} products (10 concurrent)`)

    return {
      success: true,
      productsTriggered: products.length,
      timestamp: new Date().toISOString(),
    }
  }
)

// Export all functions as an array for registration
export const inngestFunctions = [
  syncProduct,
  syncAllProducts,
  syncStockXProductAllRegions,
  syncAllStockXProducts
]
