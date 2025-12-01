/**
 * StockX Activate Listing API
 * POST /api/stockx/listings/activate
 *
 * Reactivates a paused/inactive listing.
 * Resumes selling on StockX.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        { error: 'StockX is in mock mode. Real API calls are disabled.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { listingId } = body

    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing required field: listingId' },
        { status: 400 }
      )
    }

    console.log('[Activate Listing] Request:', { listingId, userId: user.id })

    // Activate via StockX API
    const result = await StockxListingsService.activateListing(user.id, listingId)

    // Update local database status in inventory_market_links
    const { error: updateError } = await supabase
      .from('inventory_market_links')
      .update({
        stockx_listing_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)
      .eq('user_id', user.id)

    if (updateError) {
      console.warn('[Activate Listing] Failed to update inventory_market_links:', updateError)
    }

    // Also update stockx_listings table (used by inventory UI)
    const { error: listingUpdateError } = await supabase
      .from('stockx_listings')
      .update({
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)

    if (listingUpdateError) {
      console.warn('[Activate Listing] Failed to update stockx_listings:', listingUpdateError)
    }

    const duration = Date.now() - startTime

    console.log('[Activate Listing] Success:', {
      listingId,
      operationId: result.operationId,
      duration,
    })

    return NextResponse.json({
      success: true,
      listingId,
      operationId: result.operationId,
      status: result.status,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Activate Listing] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to activate listing',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
