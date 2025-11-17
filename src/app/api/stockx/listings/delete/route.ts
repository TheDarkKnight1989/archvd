/**
 * StockX Delete Listing API
 * POST /api/stockx/listings/delete
 *
 * Deletes an existing listing
 * Returns operation ID for async tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { listingId } = body

    if (!listingId) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
    }

    console.log('[Delete Listing] Request:', { listingId })

    if (isStockxMockMode()) {
      return NextResponse.json(
        { error: 'StockX is in mock mode' },
        { status: 503 }
      )
    }

    // Verify listing belongs to user
    const { data: listing } = await supabase
      .from('stockx_listings')
      .select('*')
      .eq('stockx_listing_id', listingId)
      .eq('user_id', user.id)
      .single()

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Delete listing on StockX
    const operation = await StockxListingsService.deleteListing(listingId)

    // Track operation
    const jobId = await StockxListingsService.trackOperation(
      user.id,
      'delete_listing',
      operation.operationId,
      { listingId }
    )

    // Update listing status in DB (mark as deleted)
    await supabase
      .from('stockx_listings')
      .update({
        status: 'DELETED',
        updated_at: new Date().toISOString(),
      })
      .eq('stockx_listing_id', listingId)

    // Clear stockx_listing_id from inventory_market_links
    await supabase
      .from('inventory_market_links')
      .update({
        stockx_listing_id: null,
      })
      .eq('stockx_listing_id', listingId)

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      jobId,
      status: operation.status,
    })
  } catch (error: any) {
    console.error('[Delete Listing] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
