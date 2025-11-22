/**
 * StockX Full Inventory Sync API
 * Bulk sync all inventory items with StockX
 *
 * POST /api/stockx/sync/inventory
 *
 * DIRECTIVE COMPLIANCE:
 * - No direct StockX API calls in this route
 * - No V1 endpoints
 * - No direct stockx_* table access
 * - Delegates all logic to stockx-worker orchestrator
 *
 * Pipeline:
 * 1. Validate user authentication
 * 2. Parse and validate request body (mode, limit, cursor, dryRun)
 * 3. Call syncAllInventoryItemsFromStockx() orchestrator
 * 4. Return detailed sync report with pagination support
 *
 * This route is a thin wrapper around the worker layer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncAllInventoryItemsFromStockx } from '@/lib/providers/stockx-worker'
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
    // Step 2: Parse and Validate Request Body
    // ========================================================================
    let body: {
      mode?: 'mapped-only' | 'auto-discover'
      limit?: number
      cursor?: string | null
      dryRun?: boolean
    } = {}

    try {
      body = await request.json()
    } catch (parseError) {
      // Empty body is acceptable, use defaults
      body = {}
    }

    // Apply defaults and validation
    const mode = body.mode || 'mapped-only'
    const limit = Math.min(body.limit || 100, 250) // Max 250 items per run
    const cursor = body.cursor || null
    const dryRun = body.dryRun || false

    // Validate mode
    if (mode !== 'mapped-only' && mode !== 'auto-discover') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "mapped-only" or "auto-discover"' },
        { status: 400 }
      )
    }

    logger.info('[StockX Inventory Sync API] Request received', {
      userId: user.id,
      mode,
      limit,
      cursor,
      dryRun,
    })

    // ========================================================================
    // Step 3: Call Worker Orchestrator
    // ========================================================================
    const result = await syncAllInventoryItemsFromStockx({
      userId: user.id,
      mode,
      limit,
      cursor,
      dryRun,
    })

    const duration = Date.now() - startTime

    logger.apiRequest(
      '/api/stockx/sync/inventory',
      { userId: user.id, mode, limit, dryRun },
      duration,
      {
        scanned: result.totalItemsScanned,
        synced: result.totalItemsSynced,
        skipped: result.totalItemsSkipped,
        errors: result.totalErrors,
        hasMore: !!result.nextCursor,
      }
    )

    // ========================================================================
    // Step 4: Return Structured Response
    // ========================================================================
    return NextResponse.json({
      status: 'ok',
      userId: result.userId,
      mode: result.mode,
      pagination: {
        limit: result.limit,
        cursor: result.cursor,
        nextCursor: result.nextCursor,
      },
      summary: {
        totalItemsScanned: result.totalItemsScanned,
        totalItemsSynced: result.totalItemsSynced,
        totalItemsSkipped: result.totalItemsSkipped,
        totalErrors: result.totalErrors,
      },
      items: result.items,
      durationMs: duration,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[StockX Inventory Sync API] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    // Return user-friendly error
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Failed to sync inventory with StockX',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
