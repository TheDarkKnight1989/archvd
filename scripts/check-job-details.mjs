#!/usr/bin/env node
/**
 * Check Market Job Details
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkJobDetails() {
  // Get all jobs with full details
  const { data: jobs } = await supabase
    .from('market_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  console.log('Market Jobs Details:')
  console.log('═'.repeat(80))

  for (const job of jobs || []) {
    console.log(`\nJob ID: ${job.id}`)
    console.log(`  SKU: ${job.sku}:${job.size || 'N/A'}`)
    console.log(`  Status: ${job.status}`)
    console.log(`  User ID: ${job.user_id || 'N/A'}`)
    console.log(`  Priority: ${job.priority}`)
    console.log(`  Created: ${new Date(job.created_at).toLocaleString()}`)
    console.log(`  Completed: ${job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}`)
    console.log(`  Attempts: ${job.attempts || 0}`)

    if (job.error_message) {
      console.log(`  Error: ${job.error_message}`)
    }

    if (job.result) {
      console.log(`  Result:`, JSON.stringify(job.result, null, 2))
    }
  }

  console.log('\n' + '═'.repeat(80))

  // Summary
  const { data: summary } = await supabase
    .from('market_jobs')
    .select('status')

  const counts = (summary || []).reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})

  console.log('\nStatus Summary:')
  Object.entries(counts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
}

checkJobDetails()
