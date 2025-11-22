/**
 * StockX Market Latest View Refresh Cron
 * Refreshes stockx_market_latest materialized view
 * Triggered: Periodically by cron/scheduler
 * POST /api/cron/stockx/refresh-latest
 *
 * DIRECTIVE COMPLIANCE:
 * - NO StockX API calls in this route
 * - Refreshes DB materialized view only
 * - View aggregates latest snapshot per (product, variant, currency)
 *
 * Pipeline:
 * 1. Validate cron authorization
 * 2. Call refreshStockxMarketLatestView() worker
 * 3. Return refresh status summary
 *
 * This route is a thin wrapper around the worker layer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { refreshStockxMarketLatestView } from '@/lib/providers/stockx-worker'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // ========================================================================
    // Step 1: Validate Cron Authorization
    // ========================================================================
    const authHeader = request.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info('[Cron MV Refresh] Request received')

    // ========================================================================
    // Step 2: Call Worker Orchestrator
    // ========================================================================
    const result = await refreshStockxMarketLatestView({ dryRun: false })

    const duration = Date.now() - startTime

    logger.info('[Cron MV Refresh] Complete', {
      success: result.success,
      refreshed: result.refreshed,
      refreshDuration: result.durationMs,
      totalDuration: duration,
      error: result.error,
    })

    // ========================================================================
    // Step 3: Return Structured Response
    // ========================================================================
    return NextResponse.json({
      success: result.success,
      refreshed: result.refreshed,
      refreshDurationMs: result.durationMs,
      totalDurationMs: duration,
      error: result.error,
      message: result.refreshed
        ? 'stockx_market_latest materialized view refreshed successfully'
        : 'View refresh skipped or failed',
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[Cron MV Refresh] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    // Return error response
    return NextResponse.json(
      {
        success: false,
        refreshed: false,
        error: error.message || 'Failed to refresh materialized view',
        totalDurationMs: duration,
      },
      { status: 500 }
    )
  }
}
