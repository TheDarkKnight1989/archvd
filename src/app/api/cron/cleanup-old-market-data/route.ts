/**
 * Cleanup Old Market Data
 *
 * Runs daily via Vercel cron
 * Removes market snapshots older than 30 days to save database space
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🧹 Cleaning up old market data...')

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30) // 30 days ago

    const { error, count } = await supabase
      .from('master_market_data')
      .delete()
      .lt('snapshot_at', cutoffDate.toISOString())

    if (error) {
      throw error
    }

    console.log(`✅ Cleaned up ${count || 0} old snapshots`)

    return NextResponse.json({
      success: true,
      deleted: count || 0,
      cutoff: cutoffDate.toISOString(),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
