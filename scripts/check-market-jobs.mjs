#!/usr/bin/env node
/**
 * Check Market Jobs Status
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkJobs() {
  // Job status summary
  const { data: summary } = await supabase
    .from('market_jobs')
    .select('status')

  if (!summary) {
    console.log('No jobs found')
    return
  }

  const counts = summary.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})

  console.log('Market Jobs Status:')
  console.log('─'.repeat(40))
  Object.entries(counts).forEach(([status, count]) => {
    const emoji = status === 'done' ? '✅' : status === 'pending' ? '⏳' : status === 'failed' ? '❌' : '🔄'
    console.log(`  ${emoji} ${status}: ${count}`)
  })
  console.log()

  // Recent completions
  const { data: recent } = await supabase
    .from('market_jobs')
    .select('sku, size, status, completed_at')
    .order('completed_at', { ascending: false })
    .limit(5)

  console.log('Recent jobs:')
  console.log('─'.repeat(40))
  recent?.forEach(job => {
    const time = job.completed_at ? new Date(job.completed_at).toLocaleTimeString() : 'pending'
    console.log(`  ${job.sku}:${job.size} - ${job.status} (${time})`)
  })
}

checkJobs()
