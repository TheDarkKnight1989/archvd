/**
 * StockX Deactivate Listing API
 * POST /api/stockx/listings/deactivate
 *
 * Temporarily deactivates (pauses) a listing without deleting it.
 * User can reactivate later to resume selling.
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

    console.log('[Deactivate Listing] Request:', { listingId, userId: user.id })

    // Deactivate via StockX API
    const result = await StockxListingsService.deactivateListing(user.id, listingId)

    // Update local database status in inventory_market_links
    const { error: updateError } = await supabase
      .from('inventory_market_links')
      .update({
        stockx_listing_status: 'INACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)
      .eq('user_id', user.id)

    if (updateError) {
      console.warn('[Deactivate Listing] Failed to update inventory_market_links:', updateError)
    }

    // Also update stockx_listings table (used by inventory UI)
    const { error: listingUpdateError } = await supabase
      .from('stockx_listings')
      .update({
        status: 'INACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)

    if (listingUpdateError) {
      console.warn('[Deactivate Listing] Failed to update stockx_listings:', listingUpdateError)
    }

    // V4: Update inventory_v4_listings (source of truth for V4 inventory)
    const { data: v4UpdateData, error: v4UpdateError } = await supabase
      .from('inventory_v4_listings')
      .update({
        status: 'paused', // V4 uses lowercase 'paused' for deactivated
        updated_at: new Date().toISOString(),
      })
      .eq('external_listing_id', listingId)
      .eq('platform', 'stockx')
      .eq('user_id', user.id)
      .select()

    if (v4UpdateError) {
      console.warn('[Deactivate Listing] Failed to update inventory_v4_listings:', v4UpdateError)
    } else {
      console.log('[Deactivate Listing] ✅ V4 listing status updated to paused:', {
        listingId,
        rowsUpdated: v4UpdateData?.length ?? 0,
      })
    }

    const duration = Date.now() - startTime

    console.log('[Deactivate Listing] Success:', {
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

    console.error('[Deactivate Listing] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to deactivate listing',
        details: error.message,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
