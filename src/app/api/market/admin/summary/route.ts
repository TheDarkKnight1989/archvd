/**
 * GET /api/market/admin/summary
 * WHY: Admin dashboard - budgets, jobs, throughput metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = createClient()

  try {
    // 1. Get budget status for all providers
    const { data: budgets, error: budgetsError } = await supabase
      .from('market_budgets')
      .select('provider, rate_limit, used, hour_window')
      .order('provider')

    if (budgetsError) throw budgetsError

    const budgetsSummary = (budgets || []).map(b => ({
      provider: b.provider,
      tokens_left: b.rate_limit - b.used,
      refill_at: new Date(new Date(b.hour_window).getTime() + 60 * 60 * 1000).toISOString(),
      limit_per_hour: b.rate_limit,
    }))

    // 2. Get job counts
    const { data: jobCounts, error: jobCountsError } = await supabase
      .rpc('count_market_jobs_by_status')
      .single()

    if (jobCountsError) {
      console.warn('[Admin Summary] Failed to get job counts:', jobCountsError)
    }

    // Fallback: manual count if RPC doesn't exist
    const { data: allJobs } = await supabase
      .from('market_jobs')
      .select('status, updated_at')

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const jobs = {
      pending: allJobs?.filter(j => j.status === 'pending').length || 0,
      running: allJobs?.filter(j => j.status === 'running').length || 0,
      done_1h: allJobs?.filter(j => j.status === 'done' && new Date(j.updated_at) > oneHourAgo).length || 0,
      failed_1h: allJobs?.filter(j => j.status === 'failed' && new Date(j.updated_at) > oneHourAgo).length || 0,
    }

    // 3. Get throughput (last 12 x 5min buckets = 1 hour)
    const { data: metrics, error: metricsError } = await supabase
      .from('market_provider_metrics')
      .select('created_at, jobs_success')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })

    if (metricsError) {
      console.warn('[Admin Summary] Failed to get metrics:', metricsError)
    }

    // Bucket metrics into 5-minute intervals
    const now = new Date()
    const timestamps: string[] = []
    const completed: number[] = []

    for (let i = 11; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - i * 5 * 60 * 1000)
      const bucketEnd = new Date(bucketStart.getTime() + 5 * 60 * 1000)

      timestamps.push(bucketStart.toISOString().slice(11, 16)) // "HH:MM"

      const bucketMetrics = (metrics || []).filter(m => {
        const t = new Date(m.created_at)
        return t >= bucketStart && t < bucketEnd
      })

      const total = bucketMetrics.reduce((sum, m) => sum + (m.jobs_success || 0), 0)
      completed.push(total)
    }

    return NextResponse.json({
      budgets: budgetsSummary,
      jobs,
      throughput: {
        timestamps,
        completed,
      },
    })
  } catch (error: any) {
    console.error('[Admin Summary] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
