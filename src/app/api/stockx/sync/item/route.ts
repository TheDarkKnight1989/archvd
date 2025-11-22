/**
 * StockX Single Item Sync API
 * Thin controller for syncing a single inventory item with StockX
 *
 * POST /api/stockx/sync/item
 *
 * DIRECTIVE COMPLIANCE:
 * - No direct StockX API calls in this route
 * - No V1 endpoints
 * - No direct stockx_* table access
 * - Delegates all sync logic to stockx-worker orchestrator
 *
 * Pipeline:
 * 1. Validate user authentication
 * 2. Parse inventoryItemId from request body
 * 3. Call syncSingleInventoryItemFromStockx() orchestrator
 * 4. Return structured JSON response
 *
 * This route is a thin wrapper around the worker layer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncSingleInventoryItemFromStockx } from '@/lib/providers/stockx-worker'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ========================================================================
    // Step 1: Authenticate User
    // ========================================================================
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ========================================================================
    // Step 2: Parse Request Body
    // ========================================================================
    let body: { inventoryItemId?: string }

    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { inventoryItemId } = body

    if (!inventoryItemId || typeof inventoryItemId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid inventoryItemId' },
        { status: 400 }
      )
    }

    logger.info('[StockX Item Sync API] Request received', {
      userId: user.id,
      inventoryItemId,
    })

    // ========================================================================
    // Step 3: Call Worker Orchestrator
    // ========================================================================
    const result = await syncSingleInventoryItemFromStockx({
      inventoryItemId,
      userId: user.id,
    })

    const duration = Date.now() - startTime

    logger.apiRequest(
      '/api/stockx/sync/item',
      { userId: user.id, inventoryItemId },
      duration,
      {
        stockxProductId: result.stockx.productId,
        stockxVariantId: result.stockx.variantId,
        snapshotsCreated: result.market.snapshotsCreated,
      }
    )

    // ========================================================================
    // Step 4: Return Structured Response
    // ========================================================================
    return NextResponse.json({
      status: 'ok',
      itemId: result.itemId,
      stockx: {
        productId: result.stockx.productId,
        variantId: result.stockx.variantId,
        listingId: result.stockx.listingId,
      },
      market: {
        currenciesProcessed: result.market.currenciesProcessed,
        snapshotsCreated: result.market.snapshotsCreated,
      },
      durationMs: duration,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[StockX Item Sync API] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    // Return user-friendly error
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Failed to sync item with StockX',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
