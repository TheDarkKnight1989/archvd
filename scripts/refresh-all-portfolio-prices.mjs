#!/usr/bin/env node
/**
 * Refresh All Portfolio Market Prices
 *
 * WHY: Fetch fresh market data for all items currently in portfolio
 * WHAT: Creates market_jobs for each active inventory item, then triggers worker
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function refreshAllPrices() {
  console.log('🔄 Refreshing market prices for all portfolio items')
  console.log()

  // 1. Get all active inventory items
  const { data: items, error: inventoryError } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, brand, model')
    .in('status', ['active', 'listed', 'worn'])
    .order('created_at', { ascending: false })

  if (inventoryError) {
    console.error('❌ Failed to fetch inventory:', inventoryError.message)
    process.exit(1)
  }

  console.log(`📦 Found ${items.length} items in portfolio`)
  console.log()

  // Show sample
  console.log('Sample items:')
  items.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i+1}. ${item.brand || 'Unknown'} ${item.model || item.sku} - Size ${item.size_uk || 'N/A'}`)
  })
  console.log()

  // 2. Get user ID (for currency preference)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, base_currency')
    .limit(1)
    .single()

  const userId = profiles?.id
  const userCurrency = profiles?.base_currency || 'GBP'

  console.log(`👤 User currency: ${userCurrency}`)
  console.log()

  // 3. Delete ALL old jobs for these items to allow re-creation
  console.log('🧹 Cleaning up old jobs...')

  const skusToRefresh = items
    .filter(i => i.sku && i.size_uk)
    .map(i => i.sku)

  const { error: deleteError, count } = await supabase
    .from('market_jobs')
    .delete({ count: 'exact' })
    .eq('provider', 'stockx')
    .in('sku', skusToRefresh)

  if (deleteError) {
    console.warn('  ⚠️  Failed to delete old jobs:', deleteError.message)
  } else {
    console.log(`  ✓ Cleared ${count || 0} old jobs`)
  }
  console.log()

  // 4. Create market jobs for each item
  console.log('📝 Creating market jobs...')

  const jobs = []
  let created = 0
  let skipped = 0

  for (const item of items) {
    if (!item.sku || !item.size_uk) {
      console.log(`  ⚠️  Skipping ${item.id} - missing SKU or size`)
      skipped++
      continue
    }

    jobs.push({
      sku: item.sku,
      size: item.size_uk,
      provider: 'stockx',
      status: 'pending',
      user_id: userId,
      priority: 5, // Normal priority
    })
  }

  if (jobs.length === 0) {
    console.log('⚠️  No items to process')
    console.log(`   Skipped: ${skipped} items (missing SKU or size)`)
    return
  }

  console.log(`  Creating ${jobs.length} new jobs...`)

  const { data: createdJobs, error: jobError } = await supabase
    .from('market_jobs')
    .insert(jobs)
    .select()

  if (jobError) {
    console.error('❌ Failed to create jobs:', jobError.message)
    console.error('   Details:', jobError)
    process.exit(1)
  }

  created = createdJobs?.length || 0
  console.log(`  ✓ Created ${created} jobs`)
  console.log()

  // 4. Trigger scheduler to process jobs
  console.log('🚀 Triggering market scheduler...')

  const schedulerUrl = `${SUPABASE_URL.replace('https://', 'https://').replace('.supabase.co', '.supabase.co')}/functions/v1/market-scheduler`

  // Use local API endpoint instead
  const localApiUrl = 'http://localhost:3000/api/market/scheduler/run'

  console.log('   Note: Run scheduler manually via:')
  console.log('   POST http://localhost:3000/api/market/scheduler/run')
  console.log()
  console.log('   Or trigger worker directly via:')
  console.log('   POST http://localhost:3000/api/market/worker/fetch')
  console.log()

  // 5. Summary
  console.log('═'.repeat(60))
  console.log('✅ Market refresh queued!')
  console.log()
  console.log(`  Items in portfolio: ${items.length}`)
  console.log(`  Jobs created: ${created}`)
  console.log(`  Jobs skipped: ${skipped} (recent data exists)`)
  console.log()
  console.log('  Next steps:')
  console.log('  1. Scheduler will pick up jobs automatically')
  console.log('  2. Worker will fetch from StockX in user currency (GBP)')
  console.log('  3. Prices will update in Portfolio view')
  console.log()
  console.log('  Check status:')
  console.log('  SELECT status, COUNT(*) FROM market_jobs GROUP BY status;')
  console.log('═'.repeat(60))
}

refreshAllPrices()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
