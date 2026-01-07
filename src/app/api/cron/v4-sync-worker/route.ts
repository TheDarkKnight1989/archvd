/**
 * V4 Sync Queue Worker - Cron Endpoint
 *
 * POST /api/cron/v4-sync-worker
 *
 * Processes pending sync jobs from the queue.
 * Designed to be called by Vercel cron or external scheduler.
 *
 * Query params:
 * - limit?: number (default: 10, max: 50)
 * - provider?: 'stockx' | 'alias' (optional filter)
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET> (required in production)
 *
 * Response:
 * {
 *   processed: number,
 *   successful: number,
 *   failed: number,
 *   errors: Array<{ jobId, styleId, provider, error }>,
 *   duration: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { processSyncBatchV4, getQueueStatsV4 } from '@/lib/inventory-v4/sync-queue'
import type { SyncProvider } from '@/lib/inventory-v4/types'

// Force Node.js runtime - uses service role key
export const runtime = 'nodejs'

// Disable caching
export const dynamic = 'force-dynamic'

// Max duration for Vercel (60s for Hobby, 300s for Pro)
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET
const MAX_BATCH_SIZE = 50
const DEFAULT_BATCH_SIZE = 10

/**
 * Verify cron authorization
 * In production, requires CRON_SECRET header
 * Returns { ok: true } or { ok: false, reason: string }
 */
function verifyCronAuth(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  // In development, allow unauthenticated access
  if (process.env.NODE_ENV === 'development') {
    return { ok: true }
  }

  // In production, require CRON_SECRET
  if (!CRON_SECRET) {
    return { ok: false, reason: 'CRON_SECRET not configured' }
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { ok: false, reason: 'Missing Authorization header' }
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, reason: 'Invalid Authorization format (expected Bearer)' }
  }

  // Trim whitespace - some schedulers add trailing newlines
  const token = authHeader.substring(7).trim()
  if (token !== CRON_SECRET) {
    return { ok: false, reason: 'Invalid token' }
  }

  return { ok: true }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // Auth check
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    console.warn(`[V4 Sync Worker] Auth failed: ${auth.reason}`)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const limitParam = searchParams.get('limit')
    const providerParam = searchParams.get('provider')

    // Validate limit
    let limit = DEFAULT_BATCH_SIZE
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (!isNaN(parsed) && parsed > 0 && parsed <= MAX_BATCH_SIZE) {
        limit = parsed
      }
    }

    // Validate provider
    let provider: SyncProvider | undefined
    if (providerParam === 'stockx' || providerParam === 'alias') {
      provider = providerParam
    }

    // Log start with params
    console.log(
      `[V4 Sync Worker] Starting batch: limit=${limit}, provider=${provider ?? 'all'}`
    )

    // Process batch
    const result = await processSyncBatchV4(limit, provider)

    const duration = Date.now() - startTime

    // Log summary
    console.log(
      `[V4 Sync Worker] Completed: ${result.processed} processed, ` +
      `${result.successful} succeeded, ${result.failed} failed (${duration}ms)`
    )

    return NextResponse.json({
      ...result,
      duration,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[V4 Sync Worker] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: `Worker failed: ${message}`,
        duration,
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for health check / queue stats
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    console.warn(`[V4 Sync Worker] Health check auth failed: ${auth.reason}`)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const stats = await getQueueStatsV4()

    return NextResponse.json({
      status: 'healthy',
      queue: stats,
    })
  } catch (error) {
    console.error('[V4 Sync Worker] Health check error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Health check failed: ${message}` },
      { status: 500 }
    )
  }
}
