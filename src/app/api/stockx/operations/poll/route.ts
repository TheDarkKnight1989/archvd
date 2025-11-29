import { NextRequest, NextResponse } from 'next/server'
import { pollPendingOperations } from '@/lib/services/stockx/operations'
import { logger } from '@/lib/logger'

/**
 * Poll pending StockX operations
 * Checks operation status and updates database when operations complete
 *
 * This endpoint should be called periodically (e.g., every 30 seconds via cron)
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('[Operations Poller] Starting polling cycle')

    const stats = await pollPendingOperations()

    logger.info('[Operations Poller] Polling cycle complete', stats)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error: any) {
    logger.error('[Operations Poller] Error during polling cycle', {
      message: error.message,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
