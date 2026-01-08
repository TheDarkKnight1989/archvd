#!/usr/bin/env node

/**
 * Test the sync queue system end-to-end
 *
 * This script:
 * 1. Applies the migration (if needed)
 * 2. Tests trigger by updating a style catalog row
 * 3. Verifies job was queued
 * 4. Processes the job using the worker
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkTableExists(): Promise<boolean> {
  const { error } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id')
    .limit(0)

  return !error
}

async function applyMigration() {
  console.log('📋 Applying migration...')

  const migrationPath = join(process.cwd(), 'supabase/migrations/20251211_create_sync_queue_system.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  const { error } = await supabase.rpc('exec', { sql })

  if (error) {
    // Check if table already exists
    if (await checkTableExists()) {
      console.log('  ℹ️  Table already exists, skipping migration')
      return
    }
    throw new Error(`Migration failed: ${error.message}`)
  }

  console.log('  ✅ Migration applied\n')
}

async function testTriggers() {
  console.log('🧪 Testing triggers...\n')

  // Get a sample style that has both StockX and Alias data
  const { data: sampleStyle } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, stockx_url_key, alias_catalog_id')
    .not('stockx_url_key', 'is', null)
    .not('alias_catalog_id', 'is', null)
    .limit(1)
    .single()

  if (!sampleStyle) {
    console.log('  ⚠️  No suitable test data found (need a style with both StockX and Alias)')
    return
  }

  console.log(`  Test Style: ${sampleStyle.style_id}`)
  console.log(`    StockX:  ${sampleStyle.stockx_url_key}`)
  console.log(`    Alias:   ${sampleStyle.alias_catalog_id}\n`)

  // Clear existing jobs for this style
  await supabase
    .from('inventory_v4_sync_queue')
    .delete()
    .eq('style_id', sampleStyle.style_id)

  // Test 1: Trigger StockX job by updating stockx_url_key
  console.log('  Test 1: Triggering StockX job...')
  await supabase
    .from('inventory_v4_style_catalog')
    .update({ stockx_url_key: sampleStyle.stockx_url_key }) // Update to same value to trigger
    .eq('style_id', sampleStyle.style_id)

  // Check if job was created
  const { data: stockxJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .eq('style_id', sampleStyle.style_id)
    .eq('provider', 'stockx')
    .eq('status', 'pending')

  if (stockxJobs && stockxJobs.length > 0) {
    console.log('    ✅ StockX job queued successfully\n')
  } else {
    console.log('    ❌ StockX job not queued\n')
  }

  // Test 2: Trigger Alias job by updating alias_catalog_id
  console.log('  Test 2: Triggering Alias job...')
  await supabase
    .from('inventory_v4_style_catalog')
    .update({ alias_catalog_id: sampleStyle.alias_catalog_id }) // Update to same value to trigger
    .eq('style_id', sampleStyle.style_id)

  // Check if job was created
  const { data: aliasJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('*')
    .eq('style_id', sampleStyle.style_id)
    .eq('provider', 'alias')
    .eq('status', 'pending')

  if (aliasJobs && aliasJobs.length > 0) {
    console.log('    ✅ Alias job queued successfully\n')
  } else {
    console.log('    ❌ Alias job not queued\n')
  }

  return sampleStyle.style_id
}

async function showQueueStatus() {
  const { data: allJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('status, provider')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!allJobs || allJobs.length === 0) {
    console.log('  📊 Queue is empty\n')
    return
  }

  const stats = {
    pending: { stockx: 0, alias: 0 },
    processing: { stockx: 0, alias: 0 },
    success: { stockx: 0, alias: 0 },
    failed: { stockx: 0, alias: 0 },
  }

  allJobs.forEach((job: any) => {
    stats[job.status][job.provider]++
  })

  console.log('  📊 Queue Status:')
  console.log(`     Pending:    ${stats.pending.stockx} StockX, ${stats.pending.alias} Alias`)
  console.log(`     Processing: ${stats.processing.stockx} StockX, ${stats.processing.alias} Alias`)
  console.log(`     Success:    ${stats.success.stockx} StockX, ${stats.success.alias} Alias`)
  console.log(`     Failed:     ${stats.failed.stockx} StockX, ${stats.failed.alias} Alias`)
  console.log('')
}

async function main() {
  console.log('🧪 SYNC QUEUE SYSTEM - END-TO-END TEST')
  console.log('='.repeat(80))
  console.log('')

  try {
    // Step 1: Check if table exists, apply migration if needed
    const tableExists = await checkTableExists()

    if (!tableExists) {
      await applyMigration()
    } else {
      console.log('✅ Table exists\n')
    }

    // Step 2: Show current queue status
    console.log('📊 Current Queue Status:')
    await showQueueStatus()

    // Step 3: Test triggers
    await testTriggers()

    // Step 4: Show updated queue status
    console.log('📊 Updated Queue Status:')
    await showQueueStatus()

    // Step 5: Instructions
    console.log('='.repeat(80))
    console.log('')
    console.log('✅ System test complete!')
    console.log('')
    console.log('📚 Next Steps:')
    console.log('')
    console.log('  1. Process queued jobs:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts')
    console.log('')
    console.log('  2. Process with custom batch size:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --batch 20')
    console.log('')
    console.log('  3. Run in watch mode (continuous):')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --watch')
    console.log('')
    console.log('  4. Process only StockX jobs:')
    console.log('     npx tsx scripts/inventory-v4-sync-worker.ts --provider=stockx')
    console.log('')
    console.log('='.repeat(80))
    console.log('')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
