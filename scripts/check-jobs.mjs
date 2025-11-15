#!/usr/bin/env node
/**
 * Check market jobs status
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('\n📊 Market Jobs Status\n')
  console.log('=' .repeat(80))

  // Get recent jobs
  const { data: jobs, error } = await supabase
    .from('market_jobs')
    .select('id, status, provider, sku, size, created_at, started_at, completed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error fetching jobs:', error)
    return
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found')
    return
  }

  console.log(`\nFound ${jobs.length} recent jobs:\n`)

  for (const job of jobs) {
    const statusIcon =
      job.status === 'done' ? '✅' :
      job.status === 'failed' ? '❌' :
      job.status === 'running' ? '🏃' :
      job.status === 'pending' ? '⏳' :
      '⚠️'

    console.log(`${statusIcon} ${job.status.toUpperCase().padEnd(10)} ${job.provider.padEnd(8)} ${job.sku}${job.size ? ':' + job.size : ''}`)
    console.log(`   ID: ${job.id}`)
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`)
    if (job.started_at) console.log(`   Started: ${new Date(job.started_at).toLocaleString()}`)
    if (job.completed_at) console.log(`   Completed: ${new Date(job.completed_at).toLocaleString()}`)
    if (job.error_message) console.log(`   Error: ${job.error_message}`)
    console.log('')
  }

  // Get status counts
  const { data: statusCounts } = await supabase
    .from('market_jobs')
    .select('status')

  if (statusCounts) {
    const counts = statusCounts.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {})

    console.log('Status Summary:')
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })
  }
}

main().catch(console.error)
