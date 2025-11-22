/**
 * StockX Pipeline Health Check
 * Phase 2.9 - Reliability & Monitoring
 *
 * WHY: Debug endpoint to check StockX integration health
 * - No StockX API calls (DB-only checks)
 * - Returns healthy/degraded/broken status
 * - Useful for monitoring and troubleshooting
 *
 * SECURITY NOTE: No auth required - only reads DB metadata
 * Risk: Exposes existence of StockX integration (acceptable for debug)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'broken'
  timestamp: string
  checks: {
    stockxAccountExists: {
      passed: boolean
      count: number
      message: string
    }
    inventoryMappingsExist: {
      passed: boolean
      count: number
      message: string
    }
    marketSnapshotsRecent: {
      passed: boolean
      latestSnapshot: string | null
      ageMinutes: number | null
      message: string
    }
  }
  summary: string
}

export async function POST() {
  const supabase = createClient()
  const timestamp = new Date().toISOString()

  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp,
    checks: {
      stockxAccountExists: {
        passed: false,
        count: 0,
        message: '',
      },
      inventoryMappingsExist: {
        passed: false,
        count: 0,
        message: '',
      },
      marketSnapshotsRecent: {
        passed: false,
        latestSnapshot: null,
        ageMinutes: null,
        message: '',
      },
    },
    summary: '',
  }

  try {
    // ========================================================================
    // CHECK 1: StockX account exists
    // ========================================================================
    // Check if stockx_account table has valid accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('stockx_account')
      .select('id, user_id')
      .limit(10)

    if (accountsError) {
      result.checks.stockxAccountExists.passed = false
      result.checks.stockxAccountExists.count = 0
      result.checks.stockxAccountExists.message = `Error querying accounts: ${accountsError.message}`
      result.status = 'broken'
    } else {
      const count = accounts?.length || 0
      result.checks.stockxAccountExists.count = count

      if (count === 0) {
        result.checks.stockxAccountExists.passed = false
        result.checks.stockxAccountExists.message = 'No StockX accounts found'
        result.status = 'broken'
      } else {
        result.checks.stockxAccountExists.passed = true
        result.checks.stockxAccountExists.message = `${count} StockX account(s) found`
      }
    }

    // ========================================================================
    // CHECK 2: Inventory mappings exist
    // ========================================================================
    // Check if inventory_market_links has StockX mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('inventory_market_links')
      .select('id')
      .eq('provider', 'stockx')
      .limit(100)

    if (mappingsError) {
      result.checks.inventoryMappingsExist.passed = false
      result.checks.inventoryMappingsExist.count = 0
      result.checks.inventoryMappingsExist.message = `Error querying mappings: ${mappingsError.message}`
      if (result.status === 'healthy') result.status = 'degraded'
    } else {
      const count = mappings?.length || 0
      result.checks.inventoryMappingsExist.count = count

      if (count === 0) {
        result.checks.inventoryMappingsExist.passed = false
        result.checks.inventoryMappingsExist.message = 'No inventory mappings found'
        if (result.status === 'healthy') result.status = 'degraded'
      } else {
        result.checks.inventoryMappingsExist.passed = true
        result.checks.inventoryMappingsExist.message = `${count}+ StockX mapping(s) found`
      }
    }

    // ========================================================================
    // CHECK 3: Market snapshots are recent
    // ========================================================================
    // Check latest snapshot age from stockx_market_snapshots
    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('stockx_market_snapshots')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (snapshotError) {
      result.checks.marketSnapshotsRecent.passed = false
      result.checks.marketSnapshotsRecent.latestSnapshot = null
      result.checks.marketSnapshotsRecent.ageMinutes = null
      result.checks.marketSnapshotsRecent.message = `Error querying snapshots: ${snapshotError.message}`
      if (result.status === 'healthy') result.status = 'degraded'
    } else if (!latestSnapshot) {
      result.checks.marketSnapshotsRecent.passed = false
      result.checks.marketSnapshotsRecent.latestSnapshot = null
      result.checks.marketSnapshotsRecent.ageMinutes = null
      result.checks.marketSnapshotsRecent.message = 'No market snapshots found'
      if (result.status === 'healthy') result.status = 'degraded'
    } else {
      const snapshotTime = new Date(latestSnapshot.snapshot_at)
      const now = new Date()
      const ageMs = now.getTime() - snapshotTime.getTime()
      const ageMinutes = Math.floor(ageMs / 60000)

      result.checks.marketSnapshotsRecent.latestSnapshot = latestSnapshot.snapshot_at
      result.checks.marketSnapshotsRecent.ageMinutes = ageMinutes

      // Consider snapshots stale if older than 24 hours (1440 minutes)
      const STALE_THRESHOLD_MINUTES = 1440

      if (ageMinutes > STALE_THRESHOLD_MINUTES) {
        result.checks.marketSnapshotsRecent.passed = false
        result.checks.marketSnapshotsRecent.message = `Latest snapshot is ${ageMinutes} minutes old (stale)`
        if (result.status === 'healthy') result.status = 'degraded'
      } else {
        result.checks.marketSnapshotsRecent.passed = true
        result.checks.marketSnapshotsRecent.message = `Latest snapshot is ${ageMinutes} minutes old (fresh)`
      }
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    if (result.status === 'healthy') {
      result.summary = 'All StockX pipeline checks passed'
    } else if (result.status === 'degraded') {
      const failedChecks = Object.entries(result.checks)
        .filter(([_, check]) => !check.passed)
        .map(([name]) => name)
      result.summary = `StockX pipeline degraded: ${failedChecks.join(', ')}`
    } else {
      result.summary = 'StockX pipeline broken: critical checks failed'
    }

    console.log('[StockX Health Check]', result.status.toUpperCase(), result.summary)

    return NextResponse.json(result, { status: 200 })

  } catch (error: any) {
    const errorMessage = error.message || String(error)
    console.error('[StockX Health Check] Error:', errorMessage)

    return NextResponse.json(
      {
        status: 'broken',
        timestamp,
        error: errorMessage,
        summary: 'Health check failed with error',
      },
      { status: 500 }
    )
  }
}
