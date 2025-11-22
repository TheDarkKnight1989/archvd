/**
 * StockX Sparkline Rebuild API
 * Rebuilds daily median prices from historical snapshots
 *
 * POST /api/stockx/sparkline/rebuild
 *
 * DIRECTIVE COMPLIANCE:
 * - NO StockX API calls in this route
 * - Reads from stockx_market_snapshots (historical data)
 * - Writes to market_price_daily_medians (aggregated medians)
 * - All amounts in major currency units
 *
 * Pipeline:
 * 1. Authenticate user
 * 2. Parse and validate request body (daysBack, currency, dryRun)
 * 3. Call rebuildSparklineDailyMedians() worker
 * 4. Return detailed rebuild summary
 *
 * This route is a thin wrapper around the worker layer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rebuildSparklineDailyMedians } from '@/lib/providers/stockx-worker'
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
      daysBack?: number
      currency?: 'USD' | 'GBP' | 'EUR'
      dryRun?: boolean
    } = {}

    try {
      body = await request.json()
    } catch (parseError) {
      // Empty body is acceptable, use defaults
      body = {}
    }

    // Apply defaults and validation
    const daysBack = Math.max(1, Math.min(body.daysBack || 365, 365 * 3)) // 1-1095 days
    const currency = body.currency || 'GBP'
    const dryRun = body.dryRun || false

    // Validate currency
    if (!['USD', 'GBP', 'EUR'].includes(currency)) {
      return NextResponse.json(
        { error: 'Invalid currency. Must be "USD", "GBP", or "EUR"' },
        { status: 400 }
      )
    }

    logger.info('[Sparkline Rebuild API] Request received', {
      userId: user.id,
      daysBack,
      currency,
      dryRun,
    })

    // ========================================================================
    // Step 3: Call Worker Orchestrator
    // ========================================================================
    const result = await rebuildSparklineDailyMedians({
      daysBack,
      currency,
      dryRun,
    })

    const duration = Date.now() - startTime

    logger.apiRequest(
      '/api/stockx/sparkline/rebuild',
      { userId: user.id, daysBack, currency, dryRun },
      duration,
      {
        rowsScanned: result.rowsScanned,
        rowsWritten: result.rowsWritten,
        productsAffected: result.productsAffected,
        errors: result.errors,
      }
    )

    // ========================================================================
    // Step 4: Return Structured Response
    // ========================================================================
    return NextResponse.json({
      status: result.success ? 'ok' : 'error',
      daysBack: result.daysBack,
      currency: result.currency,
      summary: {
        rowsScanned: result.rowsScanned,
        rowsWritten: result.rowsWritten,
        productsAffected: result.productsAffected,
        variantsAffected: result.variantsAffected,
        errors: result.errors,
      },
      durationMs: duration,
    })

  } catch (error: any) {
    const duration = Date.now() - startTime

    logger.error('[Sparkline Rebuild API] Error', {
      error: error.message,
      stack: error.stack,
      duration,
    })

    // Return user-friendly error
    return NextResponse.json(
      {
        status: 'error',
        error: error.message || 'Failed to rebuild sparkline data',
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}
