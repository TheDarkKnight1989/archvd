/**
 * V4 StockX Product Sync Endpoint
 * POST /api/stockx/sync-product-v4?sku={sku}
 *
 * Syncs to V4 tables:
 * - inventory_v4_stockx_products
 * - inventory_v4_stockx_variants
 * - inventory_v4_stockx_market_data
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStockxProductBySku } from '@/lib/services/stockx-v4/sync'

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

    // 2. Get SKU from query params
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')

    if (!sku) {
      return NextResponse.json(
        { error: 'Missing sku query parameter' },
        { status: 400 }
      )
    }

    console.log('[Sync V4 API] Manual sync requested:', {
      userId: user.id,
      sku,
    })

    // 3. Run V4 sync
    const result = await syncStockxProductBySku(sku)

    if (!result.success) {
      console.error('[Sync V4 API] Sync failed:', result.errors)
      return NextResponse.json(
        {
          success: false,
          error: result.errors?.[0]?.error || 'Failed to sync product data',
          errors: result.errors,
        },
        { status: 500 }
      )
    }

    console.log('[Sync V4 API] Sync complete:', {
      sku,
      productId: result.productId,
      variantsSynced: result.counts.variantsSynced,
      marketDataRefreshed: result.counts.marketDataRefreshed,
      rateLimited: result.counts.rateLimited,
    })

    // 4. Return success response
    return NextResponse.json({
      success: true,
      sku,
      productId: result.productId,
      variantsSynced: result.counts.variantsSynced,
      marketDataRefreshed: result.counts.marketDataRefreshed,
      rateLimited: result.counts.rateLimited,
      warning: result.counts.rateLimited > 0
        ? `${result.counts.rateLimited} requests were rate limited`
        : undefined,
      message: `Synced ${result.counts.variantsSynced} variants and ${result.counts.marketDataRefreshed} market data rows`,
    })

  } catch (error: unknown) {
    console.error('[Sync V4 API] Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error during sync'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
