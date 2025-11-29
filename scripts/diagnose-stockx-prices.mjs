#!/usr/bin/env node

/**
 * Diagnostic Script: StockX Price Data Quality Check
 *
 * This script checks for common data quality issues in StockX market data:
 * - Currency mismatches
 * - Missing currency codes
 * - Price unit inconsistencies (cents vs major units)
 * - Stale data
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🔍 StockX Price Data Quality Diagnostic\n')
console.log('=' .repeat(80))

async function main() {
  // 1. Check user's base currency
  console.log('\n📊 1. USER CURRENCY SETTINGS')
  console.log('-'.repeat(80))

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, base_currency')
    .limit(5)

  console.log('User currencies:', profiles?.map(p => p.base_currency))
  const userCurrency = profiles?.[0]?.base_currency || 'Unknown'
  console.log(`→ Primary user currency: ${userCurrency}`)

  // 2. Check currency distribution in market snapshots
  console.log('\n📊 2. MARKET SNAPSHOT CURRENCY DISTRIBUTION')
  console.log('-'.repeat(80))

  const { data: currencyStats } = await supabase
    .from('stockx_market_snapshots')
    .select('currency_code')

  const currencyCount = {}
  currencyStats?.forEach(s => {
    currencyCount[s.currency_code] = (currencyCount[s.currency_code] || 0) + 1
  })

  console.log('Currency distribution in stockx_market_snapshots:')
  Object.entries(currencyCount).forEach(([curr, count]) => {
    console.log(`  ${curr}: ${count} snapshots`)
  })

  // 3. Check for recent sync data
  console.log('\n📊 3. RECENT MARKET DATA')
  console.log('-'.repeat(80))

  const { data: recentData } = await supabase
    .from('stockx_market_snapshots')
    .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(10)

  console.log('Latest 10 market snapshots:')
  recentData?.forEach((snap, i) => {
    const age = new Date() - new Date(snap.snapshot_at)
    const ageHours = Math.floor(age / 1000 / 60 / 60)
    console.log(`  ${i + 1}. Product ${snap.stockx_product_id.substring(0, 8)}... | ${snap.currency_code} | Ask: ${snap.lowest_ask} | Bid: ${snap.highest_bid} | Age: ${ageHours}h`)
  })

  // 4. Check for currency mismatches
  console.log('\n📊 4. CURRENCY MISMATCH DETECTION')
  console.log('-'.repeat(80))

  const { data: inventory } = await supabase
    .from('Inventory')
    .select('id, sku, size')
    .limit(5)

  if (!inventory || inventory.length === 0) {
    console.log('⚠️  No inventory items found')
    return
  }

  console.log(`Checking ${inventory.length} inventory items for StockX mappings...\n`)

  for (const item of inventory) {
    // Get StockX mapping
    const { data: links } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('inventory_id', item.id)
      .limit(1)

    if (!links || links.length === 0) {
      console.log(`  ❌ ${item.sku} - No StockX mapping`)
      continue
    }

    const link = links[0]

    // Get latest market data for this mapping
    const { data: marketData } = await supabase
      .from('stockx_market_latest')
      .select('currency_code, lowest_ask, highest_bid, last_snapshot_at')
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)
      .limit(1)

    if (!marketData || marketData.length === 0) {
      console.log(`  ⚠️  ${item.sku} (Size ${item.size}) - Mapped but no market data`)
      continue
    }

    const data = marketData[0]
    const age = new Date() - new Date(data.last_snapshot_at)
    const ageHours = Math.floor(age / 1000 / 60 / 60)

    const currencyMatch = data.currency_code === userCurrency ? '✅' : '❌'

    console.log(`  ${currencyMatch} ${item.sku} (Size ${item.size})`)
    console.log(`      Currency: ${data.currency_code} (user expects: ${userCurrency})`)
    console.log(`      Lowest Ask: ${data.lowest_ask} ${data.currency_code}`)
    console.log(`      Highest Bid: ${data.highest_bid} ${data.currency_code}`)
    console.log(`      Age: ${ageHours} hours`)
    console.log()
  }

  // 5. Check for price magnitude issues (cents vs major units)
  console.log('\n📊 5. PRICE MAGNITUDE CHECK (Cents vs Major Units)')
  console.log('-'.repeat(80))

  const { data: priceSamples } = await supabase
    .from('stockx_market_snapshots')
    .select('lowest_ask, highest_bid, currency_code')
    .not('lowest_ask', 'is', null)
    .limit(20)

  let suspiciousPrices = 0
  priceSamples?.forEach(sample => {
    // Sneaker prices typically 50-500 in major units
    // If stored in cents, would be 5000-50000
    if (sample.lowest_ask && sample.lowest_ask > 1000) {
      suspiciousPrices++
      console.log(`  ⚠️  Suspiciously high price: ${sample.lowest_ask} ${sample.currency_code} (possible cents?)`)
    }
  })

  if (suspiciousPrices === 0) {
    console.log('  ✅ All prices appear to be in major units (not cents)')
  } else {
    console.log(`  ❌ Found ${suspiciousPrices} suspicious prices that might be in cents`)
  }

  // 6. Summary and recommendations
  console.log('\n📊 6. SUMMARY & RECOMMENDATIONS')
  console.log('='.repeat(80))

  const currencyMismatch = Object.keys(currencyCount).some(c => c !== userCurrency)

  if (currencyMismatch) {
    console.log('❌ ISSUE DETECTED: Currency mismatch')
    console.log(`   Your base currency: ${userCurrency}`)
    console.log(`   Currencies in DB: ${Object.keys(currencyCount).join(', ')}`)
    console.log('   → Prices fetched in wrong currency will be incorrect!')
    console.log('   → FIX: Ensure all StockX API calls use base_currency from user profile')
  } else {
    console.log('✅ All market data matches user currency')
  }

  const stalestData = recentData?.[0]
  if (stalestData) {
    const age = new Date() - new Date(stalestData.snapshot_at)
    const ageHours = Math.floor(age / 1000 / 60 / 60)

    if (ageHours > 24) {
      console.log(`\n⚠️  WARNING: Data is ${ageHours} hours old (stale)`)
      console.log('   → Run sync to fetch fresh prices')
    } else {
      console.log(`\n✅ Data is fresh (${ageHours} hours old)`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('Diagnostic complete.')
}

main().catch(console.error)
