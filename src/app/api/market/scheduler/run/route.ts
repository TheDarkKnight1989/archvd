/**
 * Market Scheduler - Runs every 15 minutes via Vercel cron
 * WHY: Batch process pending market data jobs without hitting rate limits
 *
 * Flow:
 * 1. Ensure provider budgets exist for current hour
 * 2. Select pending jobs that fit within rate limit budgets
 * 3. Mark selected jobs as running
 * 4. Group by provider and forward to worker endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { withServiceAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/service'
import { nowUtc } from '@/lib/time'

// Provider rate limits per hour
const PROVIDER_LIMITS = {
  stockx: 100,  // 100 calls per hour
  alias: 200,   // Higher limit for alias
  ebay: 150,
}

// Max jobs per scheduler run (batch size)
const MAX_BATCH_SIZE = 20

async function handleScheduler(req: NextRequest) {
  const supabase = createClient()
  const runId = crypto.randomUUID()
  const startedAt = nowUtc()

  console.log(`[Scheduler ${runId}] Starting at ${startedAt}`)

  try {
    // 1. Ensure budgets exist for current hour window
    const currentHour = new Date()
    currentHour.setMinutes(0, 0, 0)
    const hourKey = currentHour.toISOString()

    for (const [provider, limit] of Object.entries(PROVIDER_LIMITS)) {
      const { error } = await supabase.from('market_budgets').upsert({
        provider,
        hour_window: hourKey,
        rate_limit: limit,
        used: 0,
      }, {
        onConflict: 'provider,hour_window',
        ignoreDuplicates: true,
      })

      if (error) {
        console.error(`[Scheduler ${runId}] Failed to ensure budget for ${provider}:`, error)
      }
    }

    // 2. Get current budget usage
    const { data: budgets } = await supabase
      .from('market_budgets')
      .select('provider, rate_limit, used')
      .eq('hour_window', hourKey)

    const budgetMap = new Map(
      budgets?.map(b => [b.provider, { limit: b.rate_limit, used: b.used }]) || []
    )

    console.log(`[Scheduler ${runId}] Budget status:`, Object.fromEntries(budgetMap))

    // 3. Select pending jobs that fit within budgets
    const { data: pendingJobs } = await supabase
      .from('market_jobs')
      .select('id, provider, sku, size, priority, user_id')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH_SIZE * 2) // Get extra in case some don't fit budget

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log(`[Scheduler ${runId}] No pending jobs`)
      return NextResponse.json({
        success: true,
        runId,
        selected: 0,
        message: 'No pending jobs',
      })
    }

    console.log(`[Scheduler ${runId}] Found ${pendingJobs.length} pending jobs`)

    // Select jobs that fit within budgets
    const selectedJobs: typeof pendingJobs = []
    const providerCounts = new Map<string, number>()

    for (const job of pendingJobs) {
      const budget = budgetMap.get(job.provider)
      if (!budget) continue

      const currentUsed = budget.used + (providerCounts.get(job.provider) || 0)
      if (currentUsed < budget.limit) {
        selectedJobs.push(job)
        providerCounts.set(job.provider, (providerCounts.get(job.provider) || 0) + 1)

        if (selectedJobs.length >= MAX_BATCH_SIZE) break
      }
    }

    if (selectedJobs.length === 0) {
      console.log(`[Scheduler ${runId}] No jobs fit within budget limits`)
      return NextResponse.json({
        success: true,
        runId,
        selected: 0,
        message: 'All providers at rate limit',
      })
    }

    console.log(`[Scheduler ${runId}] Selected ${selectedJobs.length} jobs by provider:`, Object.fromEntries(providerCounts))

    // 4. Mark selected jobs as running
    const jobIds = selectedJobs.map(j => j.id)
    const { error: updateError } = await supabase
      .from('market_jobs')
      .update({ status: 'running', started_at: nowUtc() })
      .in('id', jobIds)

    if (updateError) {
      console.error(`[Scheduler ${runId}] Failed to mark jobs as running:`, updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update job status',
      }, { status: 500 })
    }

    // 5. Group by provider and call worker
    const jobsByProvider = new Map<string, typeof selectedJobs>()
    for (const job of selectedJobs) {
      const jobs = jobsByProvider.get(job.provider) || []
      jobs.push(job)
      jobsByProvider.set(job.provider, jobs)
    }

    const workerResults = []
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    for (const [provider, jobs] of jobsByProvider.entries()) {
      console.log(`[Scheduler ${runId}] Forwarding ${jobs.length} ${provider} jobs to worker`)

      try {
        const workerRes = await fetch(`${baseUrl}/api/market/worker/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            provider,
            jobs: jobs.map(j => ({ id: j.id, sku: j.sku, size: j.size, user_id: j.user_id })),
            runId,
          }),
        })

        const workerData = await workerRes.json()
        workerResults.push({ provider, success: workerRes.ok, data: workerData })

      } catch (error) {
        console.error(`[Scheduler ${runId}] Worker call failed for ${provider}:`, error)
        workerResults.push({ provider, success: false, error: String(error) })
      }
    }

    // 6. Log run summary
    const completedAt = nowUtc()
    await supabase.from('market_job_runs').insert({
      run_id: runId,
      started_at: startedAt,
      completed_at: completedAt,
      jobs_selected: selectedJobs.length,
      jobs_succeeded: workerResults.filter(r => r.success).reduce((sum, r) => sum + (r.data?.succeeded || 0), 0),
      jobs_failed: workerResults.filter(r => r.success).reduce((sum, r) => sum + (r.data?.failed || 0), 0),
    })

    console.log(`[Scheduler ${runId}] Completed at ${completedAt}`)

    return NextResponse.json({
      success: true,
      runId,
      selected: selectedJobs.length,
      results: workerResults,
    })

  } catch (error) {
    console.error(`[Scheduler ${runId}] Error:`, error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}

export const POST = withServiceAuth(handleScheduler)
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for hobby plan
