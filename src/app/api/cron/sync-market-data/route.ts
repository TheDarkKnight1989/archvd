/**
 * Sync Market Data - Comprehensive Multi-Region Sync
 *
 * Runs every 6 hours via Vercel cron
 * Syncs ALL market data: pricing, histograms, sales (all regions)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { AliasClient } from '@/lib/services/alias/client'
import { syncAliasProductMultiRegion } from '@/lib/services/alias/sync'
import { syncProductAllRegions as syncStockXProductAllRegions } from '@/lib/services/stockx/market-refresh'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔄 Comprehensive Market Data Sync - Starting...')

  try {
    // Get products that need syncing based on tier
    const productsToSync = await getProductsForSync()

    console.log(`Found ${productsToSync.length} products to sync`)

    const aliasClient = new AliasClient(undefined) // App-level auth

    let synced = 0
    let errors = 0
    let totalVariants = 0

    // Sync in batches to avoid timeout
    const BATCH_SIZE = 5 // Smaller batches due to comprehensive sync
    for (let i = 0; i < productsToSync.length; i += BATCH_SIZE) {
      const batch = productsToSync.slice(i, i + BATCH_SIZE)

      await Promise.allSettled(
        batch.map(async (product) => {
          try {
            const result = await syncProductComprehensive(product, aliasClient)
            if (result.success) {
              synced++
              totalVariants += result.totalVariants
            } else {
              errors++
            }
          } catch (error) {
            console.error(`Failed to sync ${product.sku}:`, error)
            errors++
          }
        })
      )

      // Delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Update last_synced_at for all processed products
    await supabase
      .from('products')
      .update({ last_synced_at: new Date().toISOString() })
      .in('id', productsToSync.map(p => p.id))

    console.log(`✅ Sync complete - Synced: ${synced}, Errors: ${errors}, Variants: ${totalVariants}`)

    return NextResponse.json({
      success: true,
      synced,
      errors,
      totalVariants,
      total: productsToSync.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function getProductsForSync() {
  const now = new Date()

  // HOT tier: Sync if >1 hour old
  const { data: hotProducts } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      brand,
      model,
      tier,
      product_variants (
        id,
        size_key,
        size_numeric,
        stockx_variant_id,
        alias_catalog_id
      )
    `)
    .eq('tier', 'hot')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}`)
    .limit(20)

  // WARM tier: Sync if >6 hours old
  const { data: warmProducts } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      brand,
      model,
      tier,
      product_variants (
        id,
        size_key,
        size_numeric,
        stockx_variant_id,
        alias_catalog_id
      )
    `)
    .eq('tier', 'warm')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()}`)
    .limit(50)

  // COLD tier: Sync if >24 hours old
  const { data: coldProducts } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      brand,
      model,
      tier,
      product_variants (
        id,
        size_key,
        size_numeric,
        stockx_variant_id,
        alias_catalog_id
      )
    `)
    .eq('tier', 'cold')
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`)
    .limit(100)

  return [...(hotProducts || []), ...(warmProducts || []), ...(coldProducts || [])]
}

async function syncProductComprehensive(product: any, aliasClient: AliasClient) {
  console.log(`\n🔄 Syncing ${product.sku}...`)

  const aliasVariant = product.product_variants.find((v: any) => v.alias_catalog_id)
  const stockxVariant = product.product_variants.find((v: any) => v.stockx_product_id)

  let totalVariants = 0
  let success = false

  // Sync Alias data (all regions + histograms + sales)
  if (aliasVariant?.alias_catalog_id) {
    try {
      const result = await syncAliasProductMultiRegion(
        aliasClient,
        aliasVariant.alias_catalog_id,
        {
          sku: product.sku,
          userRegion: 'UK', // Default primary region
          syncSecondaryRegions: true, // Sync all regions (US, UK, EU, global)
        }
      )

      if (result.success) {
        totalVariants += result.totalVariantsIngested
        success = true
        console.log(`  ✅ Alias: ${result.totalVariantsIngested} variants synced`)
      } else {
        console.error(`  ❌ Alias sync failed: ${result.primaryResult.error}`)
      }
    } catch (error: any) {
      console.error(`  ❌ Alias sync error: ${error.message}`)
    }
  } else {
    console.log(`  ⏭️  No Alias catalog ID`)
  }

  // Sync StockX data (all regions + flex pricing + pricing suggestions)
  if (stockxVariant?.stockx_product_id) {
    try {
      const result = await syncStockXProductAllRegions(
        undefined, // No user (app-level auth)
        stockxVariant.stockx_product_id,
        'UK', // Default primary region
        true // Sync all regions (USD, GBP, EUR)
      )

      if (result.success) {
        totalVariants += result.totalSnapshotsCreated
        success = true
        console.log(`  ✅ StockX: ${result.totalSnapshotsCreated} snapshots synced`)
      } else {
        console.error(`  ❌ StockX sync failed: ${result.primaryResult.error}`)
      }
    } catch (error: any) {
      console.error(`  ❌ StockX sync error: ${error.message}`)
    }
  } else {
    console.log(`  ⏭️  No StockX product ID`)
  }

  return { success, totalVariants }
}
