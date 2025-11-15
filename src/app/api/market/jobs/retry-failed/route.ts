/**
 * POST /api/market/jobs/retry-failed
 * WHY: Retry failed market jobs (with backoff)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const body = await request.json()
    const { provider = 'stockx', max = 100, since_minutes = 1440 } = body

    const sinceThreshold = new Date(Date.now() - since_minutes * 60 * 1000)

    // WHY: Find failed jobs within time window
    const { data: failedJobs, error } = await supabase
      .from('market_jobs')
      .select('*')
      .eq('provider', provider)
      .eq('status', 'failed')
      .gte('updated_at', sinceThreshold.toISOString())
      .limit(max)

    if (error) throw error

    let retried = 0

    for (const job of failedJobs || []) {
      // WHY: Reset job to pending with incremented retry count
      const { error: updateError } = await supabase
        .from('market_jobs')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          error_message: null,
          retry_count: (job.retry_count || 0) + 1,
          priority: job.priority || 120, // Slightly higher priority for retries
        })
        .eq('id', job.id)

      if (!updateError) retried++
    }

    console.log(`[Retry Failed] Retried ${retried} failed jobs for ${provider}`)

    return NextResponse.json({
      retried,
      message: `Retried ${retried} failed jobs for ${provider}`,
    })
  } catch (error: any) {
    console.error('[Retry Failed] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
