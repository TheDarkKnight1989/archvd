/**
 * StockX Update Listing API
 * POST /api/stockx/listings/update
 *
 * Updates an existing listing (price and/or expiry)
 * Returns operation ID for async tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService, calculateListingFees } from '@/lib/services/stockx/listings'
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
    const { listingId, askPrice, expiryDays } = body

    if (!listingId) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 })
    }

    console.log('[Update Listing] Request:', { listingId, askPrice, expiryDays })

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

    // Calculate new expiry if provided
    const expiresAt = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined

    // Update listing on StockX
    const operation = await StockxListingsService.updateListing({
      listingId,
      amount: askPrice,
      expiresAt,
    })

    // Track operation
    const jobId = await StockxListingsService.trackOperation(
      user.id,
      'update_listing',
      operation.operationId,
      { listingId, askPrice, expiryDays }
    )

    // Calculate new fee estimate
    const feeEstimate = askPrice ? calculateListingFees(askPrice, 1) : null

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      jobId,
      status: operation.status,
      feeEstimate,
    })
  } catch (error: any) {
    console.error('[Update Listing] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
