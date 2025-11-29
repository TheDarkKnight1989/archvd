#!/usr/bin/env node
/**
 * Poll a specific StockX operation by ID
 * Usage: node scripts/poll-specific-operation.mjs <operationId> <userId>
 */

import { createClient } from '@supabase/supabase-js'

const operationId = process.argv[2]
const userId = process.argv[3]

if (!operationId) {
  console.error('❌ Usage: node scripts/poll-specific-operation.mjs <operationId> [userId]')
  console.error('\nExample:')
  console.error('  node scripts/poll-specific-operation.mjs d4228f58-d80c-411f-b1fb-36be631614b3')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function pollOperation() {
  console.log(`🔍 Looking up operation: ${operationId}\n`)

  // Find the job
  const { data: job, error: jobError } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .eq('stockx_batch_id', operationId)
    .single()

  if (jobError) {
    console.error('❌ Job not found in database:', jobError.message)
    console.log('\n💡 This might be an old operation before the job tracking was added.')
    process.exit(1)
  }

  console.log('📋 Job Details:')
  console.log(`  - Job ID: ${job.id}`)
  console.log(`  - Operation: ${job.operation}`)
  console.log(`  - Status: ${job.status}`)
  console.log(`  - User ID: ${job.user_id}`)
  console.log(`  - Created: ${new Date(job.created_at).toLocaleString()}`)
  console.log(`  - Updated: ${new Date(job.updated_at).toLocaleString()}`)

  if (job.results) {
    console.log(`\n📦 Operation Details:`)
    console.log(`  - Inventory Item ID: ${job.results.inventoryItemId}`)
    console.log(`  - Product ID: ${job.results.productId}`)
    console.log(`  - Variant ID: ${job.results.variantId}`)
    console.log(`  - Ask Price: ${job.results.currencyCode} ${job.results.askPrice}`)
  }

  if (job.status === 'COMPLETED') {
    console.log('\n✅ Job already completed!')
    return
  }

  if (job.status === 'FAILED') {
    console.log('\n❌ Job already failed!')
    console.log(`   Error: ${job.error_message}`)
    return
  }

  console.log('\n⏳ Job is pending - triggering polling endpoint...\n')

  // Trigger polling
  const response = await fetch('http://localhost:3000/api/stockx/operations/poll', {
    method: 'POST',
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('❌ Polling failed:', result.error)
    process.exit(1)
  }

  console.log('✅ Polling complete!')
  console.log(`\nStats:`)
  console.log(`  - Processed: ${result.stats.processed}`)
  console.log(`  - Completed: ${result.stats.completed}`)
  console.log(`  - Failed: ${result.stats.failed}`)
  console.log(`  - In Progress: ${result.stats.inProgress}`)
  console.log(`  - Timed Out: ${result.stats.timedOut}`)

  // Check job status again
  const { data: updatedJob } = await supabase
    .from('stockx_batch_jobs')
    .select('*')
    .eq('id', job.id)
    .single()

  console.log(`\n📊 Updated Job Status: ${updatedJob.status}`)

  if (updatedJob.status === 'COMPLETED') {
    console.log('✅ Operation completed successfully!')

    // Check if listing ID was saved
    if (job.results?.inventoryItemId) {
      const { data: link } = await supabase
        .from('inventory_market_links')
        .select('stockx_listing_id')
        .eq('item_id', job.results.inventoryItemId)
        .single()

      if (link?.stockx_listing_id) {
        console.log(`\n🎉 Listing ID saved: ${link.stockx_listing_id}`)
      } else {
        console.log('\n⚠️  Warning: Listing ID not found in inventory_market_links')
      }
    }
  } else if (updatedJob.status === 'FAILED') {
    console.log(`❌ Operation failed: ${updatedJob.error_message}`)
  } else {
    console.log('⏳ Operation still pending - may need more time')
  }
}

pollOperation().catch(console.error)
