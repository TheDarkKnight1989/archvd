// @ts-nocheck
/**
 * StockX Delete Listing API
 * POST /api/stockx/listings/delete
 *
 * Deletes (cancels) a StockX listing
 * Returns operationId for async tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StockxListingsService } from '@/lib/services/stockx/listings'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    // Parse request body
    const body = await request.json()
    const { listingId } = body

    // Validate required fields
    if (!listingId) {
      return NextResponse.json(
        { error: 'Missing required field: listingId' },
        { status: 400 }
      )
    }

    console.log('[Delete Listing] Request:', { listingId, userId: user.id })

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

    // Delete listing on StockX
    // The service layer handles:
    // - Calling StockX API to delete the listing
    // - Marking as MISSING if listing is already gone (404/410/422)
    // - Propagating 401 errors (auth failures)
    console.log('[Delete Listing] Calling StockX API with:', {
      userId: user.id,
      listingId,
    })

    const operation = await StockxListingsService.deleteListing(user.id, listingId)

    console.log('[Delete Listing] Operation completed:', operation)

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      operationId: operation.operationId,
      status: operation.status,
      duration_ms: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    console.error('[Delete Listing] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete listing',
        details: error.stack,
        duration_ms: duration,
      },
      { status: 500 }
    )
  }
}
