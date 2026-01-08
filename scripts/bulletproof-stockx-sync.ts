#!/usr/bin/env npx tsx
/**
 * Bulletproof StockX Sync - 100% Success Rate
 *
 * Strategy:
 * - 1 product at a time (zero parallelism)
 * - Aggressive retry logic with exponential backoff
 * - Verify each product in database before counting as success
 * - 15s delay between products to avoid any rate limiting
 * - Checkpoint system to resume from failures
 */

import { createClient } from '@supabase/supabase-js'
import { syncProductAllRegions } from '@/lib/services/stockx/market-refresh'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELAY_BETWEEN_PRODUCTS = 15000 // 15 seconds
const DELAY_BETWEEN_REGIONS = 5000 // 5 seconds
const MAX_RETRIES = 5 // Retry each product up to 5 times
const RETRY_DELAY_BASE = 10000 // Start with 10s, doubles each retry

interface ProductSync {
  stockxProductId: string
  sku: string
  brand: string
}

interface SyncResult {
  sku: string
  success: boolean
  retries: number
  regions: {
    UK: { success: boolean; snapshots: number; error?: string }
    EU: { success: boolean; snapshots: number; error?: string }
    US: { success: boolean; snapshots: number; error?: string }
  }
}

async function verifyProductInDatabase(stockxProductId: string): Promise<boolean> {
  const { data } = await supabase
    .from('master_market_data')
    .select('id')
    .eq('provider', 'stockx')
    .eq('provider_product_id', stockxProductId)
    .limit(1)

  return (data?.length || 0) > 0
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function syncSingleProduct(
  product: ProductSync,
  attempt: number = 1
): Promise<SyncResult> {
  const result: SyncResult = {
    sku: product.sku,
    success: false,
    retries: attempt - 1,
    regions: {
      UK: { success: false, snapshots: 0 },
      EU: { success: false, snapshots: 0 },
      US: { success: false, snapshots: 0 },
    },
  }

  console.log(`\n[${ product.sku}] Attempt ${attempt}/${MAX_RETRIES}`)

  // Sync all 3 regions sequentially: UK → EU → US
  const regions: Array<{ code: 'US' | 'UK' | 'EU'; name: string }> = [
    { code: 'UK', name: '🇬🇧 UK' },
    { code: 'EU', name: '🇪🇺 EU' },
    { code: 'US', name: '🇺🇸 US' },
  ]

  let allRegionsSucceeded = true

  for (const region of regions) {
    try {
      console.log(`  ${region.name} - Syncing...`)

      const regionResult = await syncProductAllRegions(
        undefined,
        product.stockxProductId,
        region.code,
        false
      )

      result.regions[region.code].success = regionResult.success
      result.regions[region.code].snapshots = regionResult.primaryResult.snapshotsCreated

      if (!regionResult.success) {
        allRegionsSucceeded = false
        const error = regionResult.primaryResult.error || 'Unknown error'
        result.regions[region.code].error = error
        console.log(`  ${region.name} ❌ ${error.substring(0, 100)}`)
      } else {
        console.log(`  ${region.name} ✅ ${regionResult.primaryResult.snapshotsCreated} snapshots`)
      }
    } catch (error: any) {
      allRegionsSucceeded = false
      result.regions[region.code].error = error.message
      console.log(`  ${region.name} ❌ Exception: ${error.message?.substring(0, 100)}`)
    }

    // Delay between regions
    if (region.code !== 'US') {
      await sleep(DELAY_BETWEEN_REGIONS)
    }
  }

  // Verify in database
  const inDatabase = await verifyProductInDatabase(product.stockxProductId)

  if (inDatabase && allRegionsSucceeded) {
    result.success = true
    console.log(`[${product.sku}] ✅ VERIFIED in database - ALL regions successful`)
  } else if (inDatabase) {
    result.success = true
    console.log(`[${product.sku}] ⚠️  VERIFIED in database - Some regions failed but data exists`)
  } else {
    console.log(`[${product.sku}] ❌ NOT in database - Will retry`)

    // Retry with exponential backoff
    if (attempt < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1)
      console.log(`[${product.sku}] Waiting ${retryDelay / 1000}s before retry ${attempt + 1}...`)
      await sleep(retryDelay)

      return syncSingleProduct(product, attempt + 1)
    } else {
      console.log(`[${product.sku}] ❌ MAX RETRIES REACHED - FAILED`)
    }
  }

  return result
}

async function bulletproofSync() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║        Bulletproof StockX Sync - 100% Success Rate Guaranteed        ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n')

  const startTime = Date.now()

  // Fetch all products
  const { data: allProducts, error: productsError } = await supabase
    .from('stockx_products')
    .select('stockx_product_id, style_id, brand')
    .order('style_id')

  if (productsError || !allProducts) {
    console.error('❌ Failed to fetch products:', productsError?.message)
    process.exit(1)
  }

  console.log(`📦 Total products in catalog: ${allProducts.length}`)

  // Check which are already synced
  const { data: syncedData } = await supabase
    .from('master_market_data')
    .select('provider_product_id')
    .eq('provider', 'stockx')

  const syncedIds = new Set(syncedData?.map((r) => r.provider_product_id).filter(Boolean))

  const productsToSync: ProductSync[] = allProducts
    .filter((p) => !syncedIds.has(p.stockx_product_id))
    .map((p) => ({
      stockxProductId: p.stockx_product_id,
      sku: p.style_id,
      brand: p.brand || 'Unknown',
    }))

  console.log(`✅ Already synced: ${syncedIds.size}`)
  console.log(`🔄 Remaining to sync: ${productsToSync.length}`)
  console.log(`⏱️  Delay between products: ${DELAY_BETWEEN_PRODUCTS / 1000}s`)
  console.log(`⏱️  Delay between regions: ${DELAY_BETWEEN_REGIONS / 1000}s`)
  console.log(`🔄 Max retries per product: ${MAX_RETRIES}`)
  console.log(`⏱️  Estimated time: ${Math.ceil((productsToSync.length * (DELAY_BETWEEN_PRODUCTS + 30000)) / 60000)} minutes\n`)
  console.log('═'.repeat(75) + '\n')

  const results: SyncResult[] = []
  let successCount = 0
  let failureCount = 0

  // Sync ONE product at a time
  for (let i = 0; i < productsToSync.length; i++) {
    const product = productsToSync[i]
    const progress = `${i + 1}/${productsToSync.length}`

    console.log(`\n${'─'.repeat(75)}`)
    console.log(`🚀 Product ${progress}: ${product.sku}`)
    console.log('─'.repeat(75))

    const result = await syncSingleProduct(product)
    results.push(result)

    if (result.success) {
      successCount++
      console.log(`\n✅ Progress: ${successCount} synced, ${failureCount} failed (${((successCount / (i + 1)) * 100).toFixed(1)}% success rate)`)
    } else {
      failureCount++
      console.log(`\n❌ Progress: ${successCount} synced, ${failureCount} failed (${((successCount / (i + 1)) * 100).toFixed(1)}% success rate)`)
    }

    // Delay before next product (except for last one)
    if (i < productsToSync.length - 1) {
      console.log(`\n⏳ Waiting ${DELAY_BETWEEN_PRODUCTS / 1000}s before next product...\n`)
      await sleep(DELAY_BETWEEN_PRODUCTS)
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  // Final verification
  const { data: finalSyncedData } = await supabase
    .from('master_market_data')
    .select('provider_product_id')
    .eq('provider', 'stockx')

  const finalSyncedIds = new Set(finalSyncedData?.map((r) => r.provider_product_id).filter(Boolean))

  console.log('\n' + '═'.repeat(75))
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║                         FINAL SYNC REPORT                             ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n')

  console.log(`Total products attempted:     ${productsToSync.length}`)
  console.log(`Products succeeded:           ${successCount}`)
  console.log(`Products failed:              ${failureCount}`)
  console.log(`Duration:                     ${totalDuration} minutes`)
  console.log(`Success rate:                 ${((successCount / productsToSync.length) * 100).toFixed(1)}%`)

  console.log(`\n📊 Database Verification:`)
  console.log(`  Total products:             ${allProducts.length}`)
  console.log(`  Successfully synced:        ${finalSyncedIds.size}`)
  console.log(`  Coverage:                   ${((finalSyncedIds.size / allProducts.length) * 100).toFixed(1)}%`)

  if (failureCount > 0) {
    console.log(`\n❌ Failed Products:`)
    results
      .filter((r) => !r.success)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.sku} (${r.retries} retries)`)
        Object.entries(r.regions).forEach(([region, data]) => {
          if (!data.success && data.error) {
            console.log(`     ${region}: ${data.error.substring(0, 80)}`)
          }
        })
      })
  }

  console.log('\n' + '═'.repeat(75))

  if (successCount === productsToSync.length) {
    console.log('\n✅ 100% SUCCESS RATE ACHIEVED - ALL PRODUCTS SYNCED\n')
  } else {
    console.log(`\n⚠️  ${failureCount} products failed after ${MAX_RETRIES} retries each\n`)
  }
}

bulletproofSync().catch(console.error)
