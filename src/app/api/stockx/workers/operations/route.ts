/**
 * StockX Operations Polling Worker
 * GET /api/stockx/workers/operations
 *
 * Polls pending StockX operations and updates database when complete
 *
 * This endpoint should be called via cron every 30 seconds
 * Vercel Cron example:
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/stockx/workers/operations",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * ```
 *
 * Features:
 * - Polls up to 50 pending operations per run
 * - Updates stockx_batch_jobs when operations complete
 * - Updates stockx_listings with final status
 * - Creates stockx_listing_history entries
 * - Handles timeouts (>15 minutes)
 * - Implements backoff for rate limits
 * - Idempotent (safe to run multiple times)
 */

import { NextRequest, NextResponse } from 'next/server'
import { pollPendingOperations } from '@/lib/services/stockx/operations'
import { logger } from '@/lib/logger'
import { isStockxMockMode } from '@/lib/config/stockx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max execution

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[Operations Worker] Starting polling cycle')

    // Check if StockX is enabled
    if (process.env.NEXT_PUBLIC_STOCKX_ENABLE !== 'true') {
      return NextResponse.json(
        {
          success: false,
          message: 'StockX integration is not enabled',
          stats: {
            processed: 0,
            completed: 0,
            failed: 0,
            timedOut: 0,
            inProgress: 0,
          },
        },
        { status: 400 }
      )
    }

    // Mock mode - return mock stats
    if (isStockxMockMode()) {
      console.log('[Operations Worker] Mock mode - skipping')
      return NextResponse.json({
        success: true,
        message: 'Mock mode - no operations to poll',
        stats: {
          processed: 0,
          completed: 0,
          failed: 0,
          timedOut: 0,
          inProgress: 0,
        },
        durationMs: Date.now() - startTime,
      })
    }

    // Poll all pending operations
    const stats = await pollPendingOperations()

    const duration = Date.now() - startTime

    // Log stats
    logger.info('[Operations Worker] Polling complete', {
      ...stats,
      durationMs: duration,
    })

    console.log('[Operations Worker] Complete:', {
      processed: stats.processed,
      completed: stats.completed,
      failed: stats.failed,
      timedOut: stats.timedOut,
      inProgress: stats.inProgress,
      durationMs: duration,
    })

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.processed} operations`,
      stats,
      durationMs: duration,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[Operations Worker] Error', {
      message: error.message,
      stack: error.stack,
      durationMs: duration,
    })

    console.error('[Operations Worker] Error:', error.message)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
