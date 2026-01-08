#!/usr/bin/env npx tsx
/**
 * Resilient StockX Sync - NO CLEANUP, Smart Resume
 *
 * Key improvements:
 * - NO PHASE 1 cleanup (preserves existing data)
 * - Skips products with complete 3-region data
 * - Longer API timeouts (30s instead of 10s)
 * - Longer delays between products (5s)
 * - Better error handling
 */

import { createClient } from '@supabase/supabase-js'
import { syncProductAllRegions } from '@/lib/services/stockx/market-refresh'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DELAY_BETWEEN_PRODUCTS = 5000 // 5 seconds - longer delay for API stability
const MAX_RETRIES = 2 // Reduced retries to fail faster
const RETRY_DELAY_BASE = 10000 // 10s base delay

interface ProductSync {
  stockxProductId: string
  sku: string
  brand: string
  currentRegions: number
}

interface SyncResult {
  sku: string
  success: boolean
  retries: number
  error?: string
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getProductRegionStatus(stockxProductId: string): Promise<number> {
  const { data } = await supabase
    .from('master_market_data')
    .select('region_code')
    .eq('provider', 'stockx')
    .eq('provider_product_id', stockxProductId)

  const regions = new Set(data?.map(r => r.region_code).filter(Boolean))
  return regions.size
}

async function syncSingleProduct(
  product: ProductSync,
  attempt: number = 1
): Promise<SyncResult> {
  const result: SyncResult = {
    sku: product.sku,
    success: false,
    retries: attempt - 1,
  }

  try {
    const syncResult = await syncProductAllRegions(
      undefined,
      product.stockxProductId,
      'UK',  // Primary region
      true   // Enable secondary region syncing (EU, US)
    )

    if (!syncResult.success) {
      result.error = syncResult.primaryResult.error || 'Unknown error'
      console.error(`  ❌ FAILED: ${result.error}`)

      // Retry on API errors
      if (attempt < MAX_RETRIES && (
        result.error.includes('timeout') ||
        result.error.includes('500') ||
        result.error.includes('504')
      )) {
        console.log(`  ⏳ Retrying in ${RETRY_DELAY_BASE * attempt / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await sleep(RETRY_DELAY_BASE * attempt)
        return syncSingleProduct(product, attempt + 1)
      }

      return result
    }

    // Check secondary results
    let allSuccess = true
    for (const [currency, secondaryResult] of Object.entries(syncResult.secondaryResults)) {
      if (!secondaryResult.success) {
        console.error(`  ❌ ${currency} region FAILED: ${secondaryResult.error || 'Unknown'}`)
        allSuccess = false
      }
    }

    if (!allSuccess && attempt < MAX_RETRIES) {
      console.log(`  ⏳ Secondary region failed, retrying...`)
      await sleep(RETRY_DELAY_BASE * attempt)
      return syncSingleProduct(product, attempt + 1)
    }

    result.success = allSuccess
  } catch (error: any) {
    result.error = error.message || String(error)
    console.error(`  ❌ EXCEPTION: ${result.error}`)

    if (attempt < MAX_RETRIES) {
      console.log(`  ⏳ Retrying after exception...`)
      await sleep(RETRY_DELAY_BASE * attempt)
      return syncSingleProduct(product, attempt + 1)
    }
  }

  return result
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║         Resilient StockX Sync - Smart Resume, No Cleanup            ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n')

  const startTime = Date.now()

  // ============================================================================
  // PHASE 1: ANALYZE CURRENT STATE
  // ============================================================================

  console.log('PHASE 1: Analyzing current state (NO CLEANUP)...\n')

  const { count: existingCount } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  console.log(`Existing StockX rows: ${existingCount}`)

  // Get all products and their current sync status
  const { data: allProducts } = await supabase
    .from('stockx_products')
    .select('stockx_product_id, style_id, brand')
    .order('style_id')

  if (!allProducts) {
    console.error('❌ Failed to fetch products')
    process.exit(1)
  }

  // Check which products are complete (have all 3 regions)
  const productsToSync: ProductSync[] = []
  const alreadyComplete: string[] = []

  for (const p of allProducts) {
    const regionCount = await getProductRegionStatus(p.stockx_product_id)

    if (regionCount === 3) {
      alreadyComplete.push(p.style_id)
    } else {
      productsToSync.push({
        stockxProductId: p.stockx_product_id,
        sku: p.style_id,
        brand: p.brand || 'Unknown',
        currentRegions: regionCount,
      })
    }
  }

  console.log(`\nSync Status:`)
  console.log(`  Complete (3 regions): ${alreadyComplete.length} products ✅`)
  console.log(`  Incomplete: ${productsToSync.length} products`)
  console.log(`  Total: ${allProducts.length} products\n`)

  if (productsToSync.length === 0) {
    console.log('✅ All products already synced!\n')
    return
  }

  console.log('═'.repeat(75) + '\n')

  // ============================================================================
  // PHASE 2: SEQUENTIAL SYNC (NO CLEANUP)
  // ============================================================================

  console.log('PHASE 2: Syncing incomplete products...\n')
  console.log(`Products to sync: ${productsToSync.length}`)
  console.log(`Delay between products: ${DELAY_BETWEEN_PRODUCTS / 1000}s`)
  console.log(`Estimated time: ~${Math.ceil((productsToSync.length * 25) / 60)} minutes\n`)
  console.log('═'.repeat(75) + '\n')

  const results: SyncResult[] = []
  let successCount = 0
  let failureCount = 0

  for (let i = 0; i < productsToSync.length; i++) {
    const product = productsToSync[i]
    const productNum = i + 1

    console.log(`\n[Product ${productNum}/${productsToSync.length}] ${product.sku} (current: ${product.currentRegions} regions)`)

    const result = await syncSingleProduct(product)
    results.push(result)

    if (result.success) {
      successCount++
      console.log(`  ✅ SUCCESS`)
    } else {
      failureCount++
      console.log(`  ❌ FAILED${result.error ? ': ' + result.error : ''}`)
    }

    console.log(`Progress: ${successCount}/${productNum} success (${((successCount / productNum) * 100).toFixed(1)}%)`)

    // Checkpoint every 10 products
    if (productNum % 10 === 0) {
      console.log('\n' + '═'.repeat(75))
      console.log(`📊 CHECKPOINT: ${productNum} PRODUCTS`)

      const { data: checkpointData } = await supabase
        .from('master_market_data')
        .select('provider_product_id, region_code')
        .eq('provider', 'stockx')

      const productRegions = new Map<string, Set<string>>()
      checkpointData?.forEach(row => {
        if (!productRegions.has(row.provider_product_id)) {
          productRegions.set(row.provider_product_id, new Set())
        }
        productRegions.get(row.provider_product_id)!.add(row.region_code)
      })

      let fullCoverage = 0
      productRegions.forEach(regions => {
        if (regions.size === 3) fullCoverage++
      })

      console.log(`   Complete products: ${fullCoverage + alreadyComplete.length}/${allProducts.length}`)
      console.log(`   Success rate: ${((successCount / productNum) * 100).toFixed(1)}%`)
      console.log('═'.repeat(75) + '\n')
    }

    // Delay before next product
    if (i + 1 < productsToSync.length) {
      await sleep(DELAY_BETWEEN_PRODUCTS)
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  // ============================================================================
  // FINAL VERIFICATION
  // ============================================================================

  console.log('\n' + '═'.repeat(75))
  console.log('FINAL VERIFICATION\n')

  const { data: finalData } = await supabase
    .from('master_market_data')
    .select('provider_product_id, region_code')
    .eq('provider', 'stockx')

  const productRegions = new Map<string, Set<string>>()
  finalData?.forEach(row => {
    if (!productRegions.has(row.provider_product_id)) {
      productRegions.set(row.provider_product_id, new Set())
    }
    productRegions.get(row.provider_product_id)!.add(row.region_code)
  })

  let fullCoverage = 0
  let partialCoverage = 0
  productRegions.forEach(regions => {
    if (regions.size === 3) {
      fullCoverage++
    } else {
      partialCoverage++
    }
  })

  console.log(`Total products: ${allProducts.length}`)
  console.log(`Complete (3 regions): ${fullCoverage} products`)
  console.log(`Coverage: ${((fullCoverage / allProducts.length) * 100).toFixed(1)}%`)
  console.log(`\nSync Results:`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Failed: ${failureCount}`)
  console.log(`  Duration: ${totalDuration} minutes`)
  console.log(`  Success rate: ${((successCount / productsToSync.length) * 100).toFixed(1)}%`)

  if (failureCount > 0) {
    console.log(`\n❌ Failed Products (first 10):`)
    results
      .filter(r => !r.success)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.sku}${r.error ? ' - ' + r.error.substring(0, 50) : ''}`)
      })
  }

  console.log('\n' + '═'.repeat(75))

  if (fullCoverage === allProducts.length) {
    console.log('\n✅ 100% SUCCESS - ALL PRODUCTS SYNCED!\n')
  } else if (fullCoverage > 0) {
    console.log(`\n⚠️  ${partialCoverage} products incomplete - re-run to retry\n`)
  } else {
    console.log(`\n❌ Sync had significant failures - check StockX API status\n`)
  }
}

main().catch(console.error)
