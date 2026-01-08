/**
 * Vercel Cron Job: Sync Alias Prices
 * Runs every 6 hours to keep all product pricing fresh across all regions
 * Configured in vercel.json crons array
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { AliasClient } from '@/lib/services/alias/client'
import { syncAliasProductMultiRegion } from '@/lib/services/alias/sync'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron Alias] No CRON_SECRET set - allowing request (dev mode)')
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  console.log('[Cron Alias] Alias price sync started')

  // Verify authorization
  if (!verifyCronSecret(request)) {
    console.error('[Cron Alias] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient()

  try {
    // ========================================================================
    // STEP 1: Get products to sync (prioritized)
    // ========================================================================

    console.log('[Cron Alias] Fetching products to sync...')

    // Priority 1: Products in active users' portfolios with Alias links
    const { data: portfolioLinks } = await supabase
      .from('inventory_alias_links')
      .select('alias_catalog_id, Inventory!inner(sku)')
      .eq('mapping_status', 'ok')
      .not('alias_catalog_id', 'is', null)
      .limit(100)

    if (!portfolioLinks || portfolioLinks.length === 0) {
      console.log('[Cron Alias] No products to sync')
      return NextResponse.json({
        success: true,
        message: 'No products to sync',
        productsProcessed: 0,
        duration: Date.now() - startTime,
      })
    }

    // Get unique catalog IDs and SKUs
    const catalogMap = new Map<string, string>()
    for (const link of portfolioLinks) {
      const inventory = link.Inventory as any
      if (inventory?.sku) {
        catalogMap.set(link.alias_catalog_id, inventory.sku)
      }
    }

    console.log(`[Cron Alias] Found ${catalogMap.size} unique products to sync`)

    // ========================================================================
    // STEP 2: Initialize Alias client
    // ========================================================================

    const aliasClient = new AliasClient(undefined) // App-level auth

    // ========================================================================
    // STEP 3: Sync each product (all regions)
    // ========================================================================

    const results = []
    let successCount = 0
    let failCount = 0
    let totalVariants = 0

    for (const [catalogId, sku] of catalogMap.entries()) {
      try {
        console.log(`[Cron Alias] Syncing ${sku} (${catalogId})...`)

        const result = await syncAliasProductMultiRegion(
          aliasClient,
          catalogId,
          {
            sku,
            userRegion: 'UK', // Default primary region
            syncSecondaryRegions: true, // Sync all regions (US, UK, EU)
          }
        )

        if (result.success) {
          successCount++
          totalVariants += result.totalVariantsIngested
          console.log(`[Cron Alias] ✅ ${sku}: ${result.totalVariantsIngested} variants`)
        } else {
          failCount++
          console.error(`[Cron Alias] ❌ ${sku}: ${result.primaryResult.error}`)
        }

        results.push({
          sku,
          catalogId,
          success: result.success,
          variants: result.totalVariantsIngested,
        })

        // Rate limiting: delay between products
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error: any) {
        failCount++
        console.error(`[Cron Alias] ❌ ${sku}: ${error.message}`)
        results.push({
          sku,
          catalogId,
          success: false,
          error: error.message,
        })
      }
    }

    // ========================================================================
    // STEP 4: Return results
    // ========================================================================

    const duration = Date.now() - startTime

    console.log('[Cron Alias] Alias price sync complete:', {
      productsProcessed: catalogMap.size,
      successCount,
      failCount,
      totalVariants,
      duration: `${(duration / 1000).toFixed(1)}s`,
    })

    return NextResponse.json({
      success: true,
      productsProcessed: catalogMap.size,
      successCount,
      failCount,
      totalVariants,
      duration,
      results,
    })

  } catch (error: any) {
    console.error('[Cron Alias] Fatal error:', error)
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
