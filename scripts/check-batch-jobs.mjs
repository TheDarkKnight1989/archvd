// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function check() {
  console.log('=== Checking Batch Jobs ===\n')

  // Get all batch jobs
  const { data: jobs, error } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!jobs || jobs.length === 0) {
    console.log('❌ No batch jobs found')
    console.log('\nThis means batch job creation is not working.')
    console.log('Expected: A batch job should be created when creating a listing.\n')
    return
  }

  console.log(`Found ${jobs.length} batch jobs:\n`)

  for (const job of jobs) {
    console.log('─'.repeat(80))
    console.log(`Job ID: ${job.id}`)
    console.log(`Operation: ${job.operation}`)
    console.log(`Status: ${job.status}`)
    console.log(`StockX Batch ID: ${job.stockx_batch_id || 'NULL'}`)
    console.log(`User ID: ${job.user_id}`)
    console.log(`Items: ${job.processed_items}/${job.total_items} (successful: ${job.successful_items || 0}, failed: ${job.failed_items})`)
    console.log(`Created: ${new Date(job.created_at).toLocaleString()}`)
    console.log(`Updated: ${new Date(job.updated_at).toLocaleString()}`)
    if (job.completed_at) {
      console.log(`Completed: ${new Date(job.completed_at).toLocaleString()}`)
    }

    const timeSinceUpdate = Date.now() - new Date(job.updated_at).getTime()
    const secondsSinceUpdate = Math.floor(timeSinceUpdate / 1000)
    console.log(`Time since update: ${secondsSinceUpdate} seconds`)

    if (job.results) {
      console.log(`Results:`, JSON.stringify(job.results, null, 2))
    }

    if (job.error_message) {
      console.log(`Error: ${job.error_message}`)
    }

    console.log()
  }

  // Check pending jobs eligible for polling
  const twentySecondsAgo = new Date(Date.now() - 20 * 1000).toISOString()
  const { data: pendingJobs } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .not('stockx_batch_id', 'is', null)
    .lt('updated_at', twentySecondsAgo)

  console.log('─'.repeat(80))
  console.log(`\n✅ Jobs eligible for polling: ${pendingJobs?.length || 0}`)

  if (pendingJobs && pendingJobs.length > 0) {
    console.log('\nThese jobs will be polled on next run:')
    pendingJobs.forEach(job => {
      console.log(`  - ${job.id} (${job.operation}, batch: ${job.stockx_batch_id})`)
    })
  }
}

check().catch(console.error)
