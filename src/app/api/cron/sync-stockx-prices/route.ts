/**
 * Vercel Cron Job: Sync StockX Prices
 *
 * Runs every hour to keep all product pricing fresh across all regions
 *
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-stockx-prices",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { syncProductAllRegions } from '@/lib/services/stockx/market-refresh'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron] No CRON_SECRET set - allowing request (dev mode)')
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  console.log('[Cron] StockX price sync started')

  // Verify authorization
  if (!verifyCronSecret(request)) {
    console.error('[Cron] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient()

  try {
    // ========================================================================
    // STEP 1: Get products to sync (prioritized)
    // ========================================================================

    console.log('[Cron] Fetching products to sync...')

    // Priority 1: Products in active users' portfolios
    const { data: portfolioProducts } = await supabase
      .from('Inventory')
      .select('sku')
      .not('sku', 'is', null)
      .limit(100)

    const portfolioSkus = [...new Set(portfolioProducts?.map(i => i.sku) || [])]

    // Priority 2: Recently viewed products (if you have analytics)
    // Priority 3: Popular products (based on some metric)

    // Get product catalog entries for these SKUs
    const { data: products } = await supabase
      .from('product_catalog')
      .select('id, sku, stockx_product_id')
      .in('sku', portfolioSkus)
      .not('stockx_product_id', 'is', null)

    if (!products || products.length === 0) {
      console.log('[Cron] No products to sync')
      return NextResponse.json({
        success: true,
        message: 'No products to sync',
        productsProcessed: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[Cron] Found ${products.length} products to sync`)

    // ========================================================================
    // STEP 2: Sync each product (all regions)
    // ========================================================================

    const results = []
    let successCount = 0
    let failCount = 0
    let totalSnapshots = 0

    for (const product of products) {
      try {
        console.log(`[Cron] Syncing ${product.sku}...`)

        const result = await syncProductAllRegions(
          undefined, // No user (app-level auth)
          product.stockx_product_id,
          'UK', // Default primary region (can be any)
          true // Sync all regions
        )

        if (result.success) {
          successCount++
          totalSnapshots += result.totalSnapshotsCreated
          console.log(`[Cron] ✅ ${product.sku}: ${result.totalSnapshotsCreated} snapshots`)
        } else {
          failCount++
          console.error(`[Cron] ❌ ${product.sku}: ${result.primaryResult.error}`)
        }

        results.push({
          sku: product.sku,
          success: result.success,
          snapshots: result.totalSnapshotsCreated,
        })

        // Rate limiting: small delay between products
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error: any) {
        failCount++
        console.error(`[Cron] ❌ ${product.sku}: ${error.message}`)
        results.push({
          sku: product.sku,
          success: false,
          error: error.message,
        })
      }
    }

    // ========================================================================
    // STEP 3: Return results
    // ========================================================================

    const duration = Date.now() - startTime

    console.log('[Cron] StockX price sync complete:', {
      productsProcessed: products.length,
      successCount,
      failCount,
      totalSnapshots,
      duration: `${(duration / 1000).toFixed(1)}s`,
    })

    return NextResponse.json({
      success: true,
      productsProcessed: products.length,
      successCount,
      failCount,
      totalSnapshots,
      duration,
      results,
    })

  } catch (error: any) {
    console.error('[Cron] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// Disable static optimization for cron routes
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes (Vercel Pro limit)
