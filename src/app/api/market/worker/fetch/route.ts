/**
 * Market Worker - Process batched jobs from scheduler
 * WHY: Execute provider-specific market data fetching with proper error handling
 *
 * Flow:
 * 1. Receive batch from scheduler
 * 2. Dispatch to provider-specific worker
 * 3. Update budgets
 * 4. Log metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { withServiceAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/service'
import { processStockXBatch, type StockXJob } from '@/lib/providers/stockx-worker'
import { nowUtc } from '@/lib/time'

interface WorkerRequest {
  provider: string
  jobs: Array<{ id: string; sku: string; size: string | null }>
  runId: string
}

async function handleWorker(req: NextRequest) {
  const supabase = createClient()

  try {
    const body: WorkerRequest = await req.json()
    const { provider, jobs, runId } = body

    if (!provider || !jobs || !Array.isArray(jobs)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
      }, { status: 400 })
    }

    console.log(`[Worker ${runId}] Processing ${jobs.length} ${provider} jobs`)

    let result: { succeeded: number; failed: number; deferred: number; details: any[] }

    // Dispatch to provider-specific worker
    switch (provider) {
      case 'stockx':
        result = await processStockXBatch(jobs as StockXJob[], runId)
        break

      case 'alias':
      case 'ebay':
        // TODO: Implement these workers
        console.log(`[Worker ${runId}] ${provider} worker not implemented yet`)
        result = {
          succeeded: 0,
          failed: jobs.length,
          deferred: 0,
          details: jobs.map(j => ({
            jobId: j.id,
            status: 'failed',
            message: `${provider} worker not implemented`,
          })),
        }

        // Mark all jobs as failed
        for (const job of jobs) {
          await supabase
            .from('market_jobs')
            .update({
              status: 'failed',
              completed_at: nowUtc(),
              error_message: `${provider} worker not implemented`,
            })
            .eq('id', job.id)
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown provider: ${provider}`,
        }, { status: 400 })
    }

    // Update budget usage
    const currentHour = new Date()
    currentHour.setMinutes(0, 0, 0)
    const hourKey = currentHour.toISOString()

    // Increment budget usage by actual API calls made
    const apiCallsMade = result.succeeded + result.failed
    if (apiCallsMade > 0) {
      const { error: budgetError } = await supabase.rpc('increment_market_budget', {
        p_provider: provider,
        p_hour_window: hourKey,
        p_increment: apiCallsMade,
      })

      if (budgetError) {
        console.error(`[Worker ${runId}] Failed to update budget:`, budgetError)
      }
    }

    // Log provider metrics
    const { error: metricsError } = await supabase.from('market_provider_metrics').insert({
      provider,
      batch_size: jobs.length,
      succeeded: result.succeeded,
      failed: result.failed,
      deferred: result.deferred,
      run_id: runId,
    })

    if (metricsError) {
      console.error(`[Worker ${runId}] Failed to log metrics:`, metricsError)
    }

    console.log(`[Worker ${runId}] Completed: ${result.succeeded}/${jobs.length} succeeded`)

    return NextResponse.json({
      success: true,
      provider,
      succeeded: result.succeeded,
      failed: result.failed,
      deferred: result.deferred,
      details: result.details,
    })

  } catch (error) {
    console.error('[Worker] Error:', error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}

export const POST = withServiceAuth(handleWorker)
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for hobby plan
