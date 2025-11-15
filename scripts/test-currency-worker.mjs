#!/usr/bin/env node
/**
 * Test script for multi-currency StockX worker
 *
 * This script will:
 * 1. Check if market_jobs table exists
 * 2. Get a user and their base currency
 * 3. Get a SKU from their inventory
 * 4. Create a high-priority job for that SKU
 * 5. Trigger the scheduler to process it
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const cronSecret = process.env.CRON_SECRET
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

if (!supabaseUrl || !supabaseKey || !cronSecret) {
  console.error('❌ Missing required environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('\n🧪 Testing Multi-Currency StockX Worker\n')
  console.log('=' .repeat(60))

  // Step 1: Check if market_jobs table exists
  console.log('\n📋 Step 1: Checking database schema...')
  const { data: tables, error: tablesError } = await supabase
    .from('market_jobs')
    .select('id')
    .limit(1)

  if (tablesError && tablesError.code === '42P01') {
    console.error('❌ market_jobs table does not exist!')
    console.error('   Run: node scripts/apply-migration.mjs 20251118_market_queue.sql')
    process.exit(1)
  }

  console.log('✅ market_jobs table exists')

  // Step 2: Get a user with base_currency set
  console.log('\n👤 Step 2: Finding a user with base_currency...')
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, base_currency')
    .not('base_currency', 'is', null)
    .limit(1)

  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found with base_currency set')
    console.error('   You may need to set base_currency in the profiles table')

    // Try to get any user
    const { data: anyUser } = await supabase.auth.admin.listUsers()
    if (anyUser?.users && anyUser.users.length > 0) {
      const userId = anyUser.users[0].id
      console.log(`   Found user: ${userId}`)
      console.log('   Setting base_currency to GBP...')

      await supabase
        .from('profiles')
        .upsert({ id: userId, base_currency: 'GBP' })

      console.log('✅ Set base_currency to GBP')
      users.push({ id: userId, base_currency: 'GBP' })
    } else {
      console.error('   No users found at all!')
      process.exit(1)
    }
  }

  const user = users[0]
  console.log(`✅ Found user: ${user.id}`)
  console.log(`   Base currency: ${user.base_currency}`)

  // Step 3: Get a SKU from inventory
  console.log('\n👟 Step 3: Finding a SKU from inventory...')
  const { data: items, error: itemsError } = await supabase
    .from('Inventory')
    .select('sku, size_uk')
    .eq('user_id', user.id)
    .not('sku', 'is', null)
    .limit(1)

  if (itemsError || !items || items.length === 0) {
    console.log('   No inventory items found, using test SKU')
    items = [{ sku: 'DD1391-100', size_uk: '10' }]
  }

  const item = items[0]
  console.log(`✅ Using SKU: ${item.sku}`)
  if (item.size_uk) {
    console.log(`   Size: UK ${item.size_uk}`)
  }

  // Step 4: Create a high-priority job
  console.log('\n📝 Step 4: Creating high-priority job...')

  // Check if job already exists
  const dedupe = `stockx|${item.sku}|${item.size_uk || ''}`
  const { data: existingJob } = await supabase
    .from('market_jobs')
    .select('id, status')
    .eq('dedupe_key', dedupe)
    .in('status', ['pending', 'running'])
    .single()

  if (existingJob) {
    console.log(`⚠️  Job already exists (${existingJob.status}): ${existingJob.id}`)
    console.log('   Will process existing job instead')
  } else {
    const { data: newJob, error: jobError } = await supabase
      .from('market_jobs')
      .insert({
        user_id: user.id,
        provider: 'stockx',
        sku: item.sku,
        size: item.size_uk ? String(item.size_uk) : null,
        priority: 200, // High priority for manual test
        status: 'pending',
        retry_count: 0,
      })
      .select('id')
      .single()

    if (jobError) {
      console.error('❌ Failed to create job:', jobError)
      process.exit(1)
    }

    console.log(`✅ Created job: ${newJob.id}`)
  }

  // Step 5: Trigger the scheduler
  console.log('\n🚀 Step 5: Triggering scheduler...')
  console.log(`   Calling: POST ${baseUrl}/api/market/scheduler/run`)

  try {
    const response = await fetch(`${baseUrl}/api/market/scheduler/run`, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`❌ Scheduler failed: ${response.status}`)
      console.error(text)
      process.exit(1)
    }

    const result = await response.json()
    console.log('✅ Scheduler completed')
    console.log('\n📊 Results:')
    console.log(`   Run ID: ${result.runId}`)
    console.log(`   Jobs selected: ${result.jobsSelected}`)
    console.log(`   Succeeded: ${result.succeeded}`)
    console.log(`   Failed: ${result.failed}`)

    // Step 6: Check the updated data
    console.log('\n🔍 Step 6: Checking updated market data...')

    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s for data to settle

    const { data: priceData } = await supabase
      .from('stockx_latest_prices')
      .select('sku, size, currency, last_sale, lowest_ask, highest_bid, as_of')
      .eq('sku', item.sku)
      .eq('size', item.size_uk || '')
      .single()

    if (priceData) {
      console.log('✅ Market data found:')
      console.log(`   SKU: ${priceData.sku}`)
      console.log(`   Currency: ${priceData.currency}`)
      if (priceData.last_sale) {
        const symbol = priceData.currency === 'GBP' ? '£' : priceData.currency === 'EUR' ? '€' : '$'
        console.log(`   Last Sale: ${symbol}${priceData.last_sale}`)
        console.log(`   Lowest Ask: ${symbol}${priceData.lowest_ask}`)
        console.log(`   Highest Bid: ${symbol}${priceData.highest_bid}`)
      }
      console.log(`   Updated: ${priceData.as_of}`)
    } else {
      console.log('⚠️  No market data found yet (may still be processing)')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Test completed!')
    console.log('\n💡 Next steps:')
    console.log('   1. Refresh your inventory page to see the updated prices')
    console.log('   2. Check that currency symbols match base_currency')
    console.log('   3. Try changing base_currency in profiles table and re-running')
    console.log('\n')

  } catch (error) {
    console.error('❌ Failed to trigger scheduler:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)
