/**
 * V4 Retention: Daily Job
 *
 * POST /api/v4/retention/daily
 *
 * Runs:
 * 1. rollup_alias_sales_daily_v4() - Aggregate raw→daily for complete days
 * 2. prune_alias_sales_history_v4() - Delete raw sales older than 90 days (by recorded_at)
 * 3. prune_alias_price_history_v4() - Delete alias price history older than 30 days
 * 4. prune_stockx_price_history_v4() - Delete stockx price history older than 30 days
 *
 * Schedule: 00:30 UTC daily
 * Auth: CRON_SECRET required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large datasets

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronAuth(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  // Development mode - allow all
  if (process.env.NODE_ENV === 'development') {
    return { ok: true }
  }

  // Vercel cron jobs are authenticated via deployment context
  // The x-vercel-cron header is only present for legitimate cron invocations
  // Note: This header cannot be spoofed from external requests on Vercel

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
  // Vercel crons work because they're internal to the deployment
  return { ok: false, reason: 'Missing or invalid authorization' }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // Auth check
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    console.warn(`[V4 Retention Daily] Auth failed: ${auth.reason}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  try {
    console.log('[V4 Retention Daily] Starting...')

    const results: Record<string, number | string> = {}

    // 1. Daily rollup
    console.log('[V4 Retention Daily] Running rollup_alias_sales_daily_v4...')
    const { data: rollupDaily, error: rollupDailyError } = await supabase.rpc('rollup_alias_sales_daily_v4')
    if (rollupDailyError) {
      console.error('[V4 Retention Daily] rollup_alias_sales_daily_v4 failed:', rollupDailyError.message)
      results.rollup_daily = `ERROR: ${rollupDailyError.message}`
    } else {
      results.rollup_daily = rollupDaily ?? 0
      console.log(`[V4 Retention Daily] rollup_alias_sales_daily_v4: ${rollupDaily} rows`)
    }

    // 2. Prune raw sales
    console.log('[V4 Retention Daily] Running prune_alias_sales_history_v4...')
    const { data: pruneRaw, error: pruneRawError } = await supabase.rpc('prune_alias_sales_history_v4')
    if (pruneRawError) {
      console.error('[V4 Retention Daily] prune_alias_sales_history_v4 failed:', pruneRawError.message)
      results.prune_sales_raw = `ERROR: ${pruneRawError.message}`
    } else {
      results.prune_sales_raw = pruneRaw ?? 0
      console.log(`[V4 Retention Daily] prune_alias_sales_history_v4: ${pruneRaw} rows deleted`)
    }

    // 3. Prune alias price history
    console.log('[V4 Retention Daily] Running prune_alias_price_history_v4...')
    const { data: pruneAliasPrice, error: pruneAliasPriceError } = await supabase.rpc('prune_alias_price_history_v4')
    if (pruneAliasPriceError) {
      console.error('[V4 Retention Daily] prune_alias_price_history_v4 failed:', pruneAliasPriceError.message)
      results.prune_alias_price = `ERROR: ${pruneAliasPriceError.message}`
    } else {
      results.prune_alias_price = pruneAliasPrice ?? 0
      console.log(`[V4 Retention Daily] prune_alias_price_history_v4: ${pruneAliasPrice} rows deleted`)
    }

    // 4. Prune stockx price history
    console.log('[V4 Retention Daily] Running prune_stockx_price_history_v4...')
    const { data: pruneStockxPrice, error: pruneStockxPriceError } = await supabase.rpc('prune_stockx_price_history_v4')
    if (pruneStockxPriceError) {
      console.error('[V4 Retention Daily] prune_stockx_price_history_v4 failed:', pruneStockxPriceError.message)
      results.prune_stockx_price = `ERROR: ${pruneStockxPriceError.message}`
    } else {
      results.prune_stockx_price = pruneStockxPrice ?? 0
      console.log(`[V4 Retention Daily] prune_stockx_price_history_v4: ${pruneStockxPrice} rows deleted`)
    }

    const duration = Date.now() - startTime

    console.log(`[V4 Retention Daily] Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[V4 Retention Daily] Error:', error)

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
    endpoint: '/api/v4/retention/daily',
    schedule: '00:30 UTC daily',
    actions: [
      'rollup_alias_sales_daily_v4',
      'prune_alias_sales_history_v4',
      'prune_alias_price_history_v4',
      'prune_stockx_price_history_v4',
    ],
  })
}
