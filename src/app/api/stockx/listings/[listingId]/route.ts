// @ts-nocheck
/**
 * StockX Get Listing API
 * GET /api/stockx/listings/[listingId]
 *
 * Fetches a single listing details from StockX
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: { listingId: string } }
) {
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

    const { listingId } = params

    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing listing ID' },
        { status: 400 }
      )
    }

    console.log('[Get Listing] Request:', { listingId, userId: user.id })

    // Check if StockX is in mock mode
    if (isStockxMockMode()) {
      return NextResponse.json(
        {
          success: false,
          error: 'StockX is in mock mode. Real API calls are disabled.',
        },
        { status: 503 }
      )
    }

    // Fetch listing from StockX
    const listing = await StockxListingsService.getListingById(user.id, listingId)

    console.log('[Get Listing] Fetched:', { listingId, amount: listing.amount })

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      ...listing,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Get Listing] Error:', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch listing',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
