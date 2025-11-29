#!/usr/bin/env node
/**
 * Check pending StockX operations
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function checkPendingJobs() {
  console.log('🔍 Checking pending StockX operations...\n')

  const { data: jobs, error } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  if (jobs.length === 0) {
    console.log('✅ No jobs found')
    return
  }

  console.log(`Found ${jobs.length} recent jobs:\n`)

  for (const job of jobs) {
    console.log('━'.repeat(60))
    console.log(`Job ID: ${job.id}`)
    console.log(`Operation: ${job.operation}`)
    console.log(`Status: ${job.status}`)
    console.log(`StockX Operation ID: ${job.stockx_batch_id}`)
    console.log(`Created: ${new Date(job.created_at).toLocaleString()}`)
    console.log(`Updated: ${new Date(job.updated_at).toLocaleString()}`)

    if (job.results) {
      console.log(`\nJob Details:`)
      console.log(`  - Inventory Item ID: ${job.results.inventoryItemId}`)
      console.log(`  - Product ID: ${job.results.productId}`)
      console.log(`  - Variant ID: ${job.results.variantId}`)
      console.log(`  - Ask Price: ${job.results.currencyCode} ${job.results.askPrice}`)
    }

    if (job.status === 'PENDING' || job.status === 'IN_PROGRESS') {
      console.log(`\n⏳ This job is still pending - run polling to complete it`)
    } else if (job.status === 'COMPLETED') {
      console.log(`\n✅ Job completed successfully`)
    } else if (job.status === 'FAILED') {
      console.log(`\n❌ Job failed: ${job.error_message}`)
    }

    console.log()
  }
}

checkPendingJobs().catch(console.error)
