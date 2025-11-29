/**
 * Manual StockX Product Sync Endpoint
 * POST /api/stockx/sync-product?productId={stockxProductId}
 *
 * PHASE 3: Safe, manual sync pipeline
 * - Triggered by user button click on Market Page
 * - NO auto-refresh on page load
 * - Requires authentication
 *
 * Steps:
 * 1. Fetch ALL variants from StockX API
 * 2. Upsert to stockx_variants table
 * 3. Fetch ALL market data from StockX API (GBP)
 * 4. Upsert to stockx_market_snapshots table
 * 5. Materialized view updates automatically
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStockxProduct } from '@/lib/services/stockx/market-refresh'

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Get productId from query params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId query parameter' },
        { status: 400 }
      )
    }

    console.log('[Sync API] Manual sync requested:', {
      userId: user.id,
      productId,
    })

    // 3. Run sync (variants + market data)
    const result = await syncStockxProduct(user.id, productId, 'GBP')

    if (!result.success) {
      console.error('[Sync API] Sync failed:', result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to sync product data',
        },
        { status: 500 }
      )
    }

    console.log('[Sync API] ✅ Sync complete:', {
      productId,
      variantsCached: result.variantsCached,
      snapshotsCreated: result.snapshotsCreated,
      warning: result.warning,
    })

    // 4. Return success response (with optional warning)
    return NextResponse.json({
      success: true,
      productId,
      variantsCached: result.variantsCached,
      snapshotsCreated: result.snapshotsCreated,
      warning: result.warning,
      message: result.warning
        ? `Synced ${result.snapshotsCreated} market snapshots (${result.warning})`
        : `Successfully synced ${result.variantsCached} variants and ${result.snapshotsCreated} market snapshots`,
    })

  } catch (error: any) {
    console.error('[Sync API] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unexpected error during sync',
      },
      { status: 500 }
    )
  }
}
