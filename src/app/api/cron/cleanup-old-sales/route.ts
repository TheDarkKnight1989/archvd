/**
 * Vercel Cron Job: Cleanup Old Sales Data
 *
 * Runs daily to delete sales older than 30 days from alias_recent_sales_detail
 * Keeps storage costs manageable while retaining recent data for trends
 *
 * Configuration in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-old-sales",
 *     "schedule": "0 4 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[Cron Cleanup] No CRON_SECRET set - allowing request (dev mode)')
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  console.log('[Cron Cleanup] Starting old sales cleanup...')

  // Verify authorization
  if (!verifyCronSecret(request)) {
    console.error('[Cron Cleanup] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const supabase = createClient()

  try {
    // Delete sales older than 30 days
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)

    console.log('[Cron Cleanup] Deleting sales older than:', cutoffDate.toISOString())

    const { error, count } = await supabase
      .from('alias_recent_sales_detail')
      .delete({ count: 'exact' })
      .lt('purchased_at', cutoffDate.toISOString())

    if (error) {
      console.error('[Cron Cleanup] Delete failed:', error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
        },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    console.log('[Cron Cleanup] Cleanup complete:', {
      deletedCount: count || 0,
      cutoffDate: cutoffDate.toISOString(),
      duration: `${(duration / 1000).toFixed(1)}s`,
    })

    return NextResponse.json({
      success: true,
      deletedCount: count || 0,
      cutoffDate: cutoffDate.toISOString(),
      duration,
    })
  } catch (error: any) {
    console.error('[Cron Cleanup] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// Disable static optimization for cron routes
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute should be plenty
