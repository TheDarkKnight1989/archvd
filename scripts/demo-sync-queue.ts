#!/usr/bin/env node

/**
 * Demo the sync queue system
 *
 * Prerequisites:
 *   1. Apply migration: supabase/migrations/20251211_create_sync_queue_system.sql
 *
 * This script demonstrates:
 *   1. Current queue status
 *   2. Manual job creation (simulating trigger)
 *   3. Shows how worker will process jobs
 */

import { createClient } from '@supabase/supabase-js'

// Explicit env validation (same pattern as worker)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function showQueueStatus() {
  const { count: pendingCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: processingCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')

  const { count: successCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')

  const { count: failedCount } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')

  console.log('📊 Queue Status:')
  console.log(`  Pending:    ${pendingCount ?? 0}`)
  console.log(`  Processing: ${processingCount ?? 0}`)
  console.log(`  Success:    ${successCount ?? 0}`)
  console.log(`  Failed:     ${failedCount ?? 0}`)
  console.log('')

  // Show some recent pending jobs
  const { data: pendingJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  if (pendingJobs && pendingJobs.length > 0) {
    console.log('  Recent Pending Jobs:')
    pendingJobs.forEach((job: any) => {
      console.log(`    - [${job.provider.toUpperCase()}] ${job.style_id} (attempts: ${job.attempts})`)
    })
    console.log('')
  }
}

async function createTestJobs() {
  console.log('🧪 Creating test jobs...\n')

  // Get 2 styles - one with StockX, one with Alias
  const { data: styles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_url_key, alias_catalog_id, brand, name')
    .not('stockx_url_key', 'is', null)
    .not('alias_catalog_id', 'is', null)
    .limit(2)

  if (!styles || styles.length === 0) {
    console.log('  ⚠️  No suitable test data found')
    return
  }

  for (const style of styles) {
    console.log(`  Creating jobs for: ${style.brand} - ${style.name}`)
    console.log(`    Style ID: ${style.style_id}`)

    // Create StockX job
    const { error: stockxError } = await supabase
      .from('inventory_v4_sync_queue')
      .insert({
        style_id: style.style_id,
        provider: 'stockx',
        status: 'pending',
      })
      .select()
      .single()

    if (stockxError && !stockxError.message.includes('duplicate')) {
      console.log(`    ❌ StockX job failed: ${stockxError.message}`)
    } else {
      console.log(`    ✅ StockX job queued`)
    }

    // Create Alias job
    const { error: aliasError } = await supabase
      .from('inventory_v4_sync_queue')
      .insert({
        style_id: style.style_id,
        provider: 'alias',
        status: 'pending',
      })
      .select()
      .single()

    if (aliasError && !aliasError.message.includes('duplicate')) {
      console.log(`    ❌ Alias job failed: ${aliasError.message}`)
    } else {
      console.log(`    ✅ Alias job queued`)
    }

    console.log('')
  }
}

async function main() {
  console.log('🚀 SYNC QUEUE SYSTEM - DEMO')
  console.log('='.repeat(80))
  console.log('')

  try {
    // Check if table exists
    const { error: checkError } = await supabase
      .from('inventory_v4_sync_queue')
      .select('id')
      .limit(0)

    if (checkError) {
      console.error('❌ Table does not exist. Please apply the migration first:')
      console.error('   supabase db push')
      console.error('')
      console.error('   Or manually run:')
      console.error('   supabase/migrations/20251211_create_sync_queue_system.sql')
      console.error('')
      process.exit(1)
    }

    console.log('✅ Table exists\n')

    // Show initial status
    console.log('📊 Initial State:')
    await showQueueStatus()

    // Create some test jobs
    await createTestJobs()

    // Show updated status
    console.log('📊 After Creating Test Jobs:')
    await showQueueStatus()

    // Instructions
    console.log('='.repeat(80))
    console.log('')
    console.log('✅ Demo complete!')
    console.log('')
    console.log('📚 Next Steps:')
    console.log('')
    console.log('  1. Process queued jobs (one time):')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts')
    console.log('')
    console.log('  2. Process with custom batch size:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --batch=20')
    console.log('')
    console.log('  3. Run in continuous watch mode:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --watch')
    console.log('')
    console.log('  4. Process only StockX jobs:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --provider=stockx')
    console.log('')
    console.log('  5. Test triggers by updating a style:')
    console.log('     UPDATE inventory_v4_style_catalog')
    console.log('     SET stockx_url_key = stockx_url_key')
    console.log('     WHERE style_id = \'DD1391-100\';')
    console.log('')
    console.log('='.repeat(80))
    console.log('')

  } catch (error) {
    console.error('\n❌ Demo failed:', error)
    process.exit(1)
  }
}

main()
