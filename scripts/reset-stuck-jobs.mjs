#!/usr/bin/env node
/**
 * Reset Stuck Market Jobs
 * WHY: Jobs that are stuck in 'running' status block the queue
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetStuckJobs() {
  console.log('🔄 Resetting stuck jobs...')
  console.log()

  // Find jobs that have been "running" for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: stuckJobs, error: fetchError } = await supabase
    .from('market_jobs')
    .select('id, sku, size, status, started_at')
    .eq('status', 'running')
    .lt('started_at', fiveMinutesAgo)

  if (fetchError) {
    console.error('❌ Failed to fetch stuck jobs:', fetchError.message)
    return
  }

  if (!stuckJobs || stuckJobs.length === 0) {
    console.log('✅ No stuck jobs found')
    return
  }

  console.log(`Found ${stuckJobs.length} stuck jobs:`)
  stuckJobs.forEach(job => {
    const started = job.started_at ? new Date(job.started_at).toLocaleString() : 'Unknown'
    console.log(`  - ${job.sku}:${job.size || 'N/A'} (started: ${started})`)
  })
  console.log()

  // Reset to pending
  const jobIds = stuckJobs.map(j => j.id)
  const { error: updateError } = await supabase
    .from('market_jobs')
    .update({
      status: 'pending',
      started_at: null,
      error_message: null,
    })
    .in('id', jobIds)

  if (updateError) {
    console.error('❌ Failed to reset jobs:', updateError.message)
    return
  }

  console.log(`✅ Reset ${stuckJobs.length} jobs to pending`)
  console.log()
  console.log('Run the scheduler to process them:')
  console.log('  curl -X POST http://localhost:3000/api/market/scheduler/run \\')
  console.log('    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"')
}

resetStuckJobs()
