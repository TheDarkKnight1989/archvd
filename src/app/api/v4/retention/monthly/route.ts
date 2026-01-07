/**
 * V4 Retention: Monthly Job
 *
 * POST /api/v4/retention/monthly
 *
 * Runs:
 * 1. rollup_alias_sales_monthly_v4() - Aggregate daily→monthly for complete months
 * 2. prune_alias_sales_daily_v4() - Delete daily aggregates older than 13 months
 *
 * Schedule: 01:00 UTC on 2nd of each month
 * Auth: CRON_SECRET required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronAuth(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  // Development mode - allow all
  if (process.env.NODE_ENV === 'development') {
    return { ok: true }
  }

  // Manual invocation with CRON_SECRET (for testing/debugging)
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      if (token === CRON_SECRET) {
        return { ok: true }
      }
    }
  }

  // In production without explicit auth, reject
  return { ok: false, reason: 'Missing or invalid authorization' }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // Auth check
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    console.warn(`[V4 Retention Monthly] Auth failed: ${auth.reason}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  try {
    console.log('[V4 Retention Monthly] Starting...')

    const results: Record<string, number | string> = {}

    // 1. Monthly rollup
    console.log('[V4 Retention Monthly] Running rollup_alias_sales_monthly_v4...')
    const { data: rollupMonthly, error: rollupMonthlyError } = await supabase.rpc('rollup_alias_sales_monthly_v4')
    if (rollupMonthlyError) {
      console.error('[V4 Retention Monthly] rollup_alias_sales_monthly_v4 failed:', rollupMonthlyError.message)
      results.rollup_monthly = `ERROR: ${rollupMonthlyError.message}`
    } else {
      results.rollup_monthly = rollupMonthly ?? 0
      console.log(`[V4 Retention Monthly] rollup_alias_sales_monthly_v4: ${rollupMonthly} rows`)
    }

    // 2. Prune daily aggregates
    console.log('[V4 Retention Monthly] Running prune_alias_sales_daily_v4...')
    const { data: pruneDaily, error: pruneDailyError } = await supabase.rpc('prune_alias_sales_daily_v4')
    if (pruneDailyError) {
      console.error('[V4 Retention Monthly] prune_alias_sales_daily_v4 failed:', pruneDailyError.message)
      results.prune_daily = `ERROR: ${pruneDailyError.message}`
    } else {
      results.prune_daily = pruneDaily ?? 0
      console.log(`[V4 Retention Monthly] prune_alias_sales_daily_v4: ${pruneDaily} rows deleted`)
    }

    const duration = Date.now() - startTime

    console.log(`[V4 Retention Monthly] Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[V4 Retention Monthly] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
        duration,
      },
      { status: 500 }
    )
  }
}

// GET for health check
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/v4/retention/monthly',
    schedule: '01:00 UTC on 2nd of month',
    actions: [
      'rollup_alias_sales_monthly_v4',
      'prune_alias_sales_daily_v4',
    ],
  })
}
