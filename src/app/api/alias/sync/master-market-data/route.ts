/**
 * Alias Master Market Data Sync API Route
 * POST /api/alias/sync/master-market-data
 *
 * Syncs Alias market data to master_market_data table (NEW system)
 * Supports multi-region sync (US, UK, EU) and metadata enrichment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'
import { AliasClient } from '@/lib/services/alias/client'
import { syncAliasProductMultiRegion } from '@/lib/services/alias/sync'
import {
  AliasAPIError,
  AliasAuthenticationError,
} from '@/lib/services/alias/errors'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

interface SyncRequest {
  /** Specific catalog ID to sync (optional) */
  catalogId?: string
  /** Specific SKU to sync (optional) */
  sku?: string
  /** Maximum number of products to sync (default: 50) */
  limit?: number
  /** User region for primary sync (default: UK) */
  userRegion?: string
  /** Sync secondary regions (default: true) */
  syncSecondaryRegions?: boolean
}

/**
 * POST /api/alias/sync/master-market-data
 *
 * Sync Alias products to master_market_data with multi-region support
 *
 * Request body:
 * {
 *   catalogId?: string        // Sync specific catalog ID
 *   sku?: string              // Sync specific SKU
 *   limit?: number            // Max products to sync (default 50)
 *   userRegion?: string       // Primary region (default UK)
 *   syncSecondaryRegions?: boolean  // Sync all regions (default true)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body: SyncRequest = await request.json()
    const {
      catalogId,
      sku,
      limit = 50,
      userRegion = 'UK',
      syncSecondaryRegions = true,
    } = body

    console.log('[Alias Master Sync API] Starting sync:', {
      catalogId,
      sku,
      limit,
      userRegion,
      syncSecondaryRegions,
    })

    const supabase = createClient()
    const aliasClient = new AliasClient(undefined) // App-level auth

    // ========================================================================
    // CASE 1: Sync specific catalog ID
    // ========================================================================

    if (catalogId) {
      console.log('[Alias Master Sync API] Syncing specific catalog:', catalogId)

      const result = await syncAliasProductMultiRegion(aliasClient, catalogId, {
        sku,
        userRegion,
        syncSecondaryRegions,
      })

      const duration = Date.now() - startTime

      return NextResponse.json({
        success: result.success,
        catalogId: result.catalogId,
        sku: result.sku,
        primaryRegion: result.primaryRegion,
        totalVariantsIngested: result.totalVariantsIngested,
        primaryResult: result.primaryResult,
        secondaryResults: result.secondaryResults,
        duration,
      })
    }

    // ========================================================================
    // CASE 2: Sync specific SKU (find catalog ID first)
    // ========================================================================

    if (sku) {
      console.log('[Alias Master Sync API] Finding catalog ID for SKU:', sku)

      const { data: link } = await supabase
        .from('inventory_alias_links')
        .select('alias_catalog_id, Inventory!inner(sku)')
        .eq('Inventory.sku', sku)
        .eq('mapping_status', 'ok')
        .not('alias_catalog_id', 'is', null)
        .single()

      if (!link || !link.alias_catalog_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'SKU not found',
            message: `No Alias catalog link found for SKU: ${sku}`,
          },
          { status: 404 }
        )
      }

      console.log('[Alias Master Sync API] Found catalog ID:', link.alias_catalog_id)

      const result = await syncAliasProductMultiRegion(
        aliasClient,
        link.alias_catalog_id,
        {
          sku,
          userRegion,
          syncSecondaryRegions,
        }
      )

      const duration = Date.now() - startTime

      return NextResponse.json({
        success: result.success,
        catalogId: result.catalogId,
        sku: result.sku,
        primaryRegion: result.primaryRegion,
        totalVariantsIngested: result.totalVariantsIngested,
        primaryResult: result.primaryResult,
        secondaryResults: result.secondaryResults,
        duration,
      })
    }

    // ========================================================================
    // CASE 3: Bulk sync (all products in portfolio)
    // ========================================================================

    console.log('[Alias Master Sync API] Bulk sync starting (limit:', limit, ')')

    const { data: portfolioLinks } = await supabase
      .from('inventory_alias_links')
      .select('alias_catalog_id, Inventory!inner(sku)')
      .eq('mapping_status', 'ok')
      .not('alias_catalog_id', 'is', null)
      .limit(limit)

    if (!portfolioLinks || portfolioLinks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products to sync',
        productsProcessed: 0,
        duration: Date.now() - startTime,
      })
    }

    // Get unique catalog IDs
    const catalogMap = new Map<string, string>()
    for (const link of portfolioLinks) {
      const inventory = link.Inventory as any
      if (inventory?.sku) {
        catalogMap.set(link.alias_catalog_id, inventory.sku)
      }
    }

    console.log('[Alias Master Sync API] Found', catalogMap.size, 'unique products')

    // Sync each product
    const results = []
    let successCount = 0
    let failCount = 0
    let totalVariants = 0

    for (const [catId, productSku] of catalogMap.entries()) {
      try {
        console.log('[Alias Master Sync API] Syncing:', productSku, `(${catId})`)

        const result = await syncAliasProductMultiRegion(aliasClient, catId, {
          sku: productSku,
          userRegion,
          syncSecondaryRegions,
        })

        if (result.success) {
          successCount++
          totalVariants += result.totalVariantsIngested
        } else {
          failCount++
        }

        results.push({
          catalogId: catId,
          sku: productSku,
          success: result.success,
          variants: result.totalVariantsIngested,
          error: result.primaryResult.error,
        })

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error: any) {
        failCount++
        console.error('[Alias Master Sync API] Error syncing', productSku, ':', error.message)
        results.push({
          catalogId: catId,
          sku: productSku,
          success: false,
          variants: 0,
          error: error.message,
        })
      }
    }

    const duration = Date.now() - startTime

    console.log('[Alias Master Sync API] Bulk sync complete:', {
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

  } catch (error) {
    console.error('[Alias Master Sync API] Error:', error)

    if (error instanceof AliasAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication Error',
          message: error.message,
          hint: 'Check that ALIAS_PAT environment variable is set correctly',
        },
        { status: 401 }
      )
    }

    if (error instanceof AliasAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alias API Error',
          message: error.message,
          statusCode: error.statusCode,
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
