#!/usr/bin/env node

/**
 * Fix StockX Price Units - Convert Cents to Major Units
 *
 * PROBLEM: Old data in stockx_market_snapshots table has prices stored in cents
 * instead of major currency units (e.g., 3954 instead of 39.54).
 *
 * This script:
 * 1. Identifies prices that are likely in cents (> 1000)
 * 2. Divides them by 100 to convert to major units
 * 3. Updates the database with corrected values
 *
 * SAFE: Only affects prices > 1000 (sneakers don't cost >$1000)
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

console.log('🔧 StockX Price Unit Fixer\n')
console.log('=' .repeat(80))

async function main() {
  // Find all prices that look like they're in cents (> 1000)
  console.log('\n📊 Step 1: Identifying corrupt prices (> 1000)\n')

  const { data: corruptSnapshots, error } = await supabase
    .from('stockx_market_snapshots')
    .select('id, stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
    .or('lowest_ask.gt.1000,highest_bid.gt.1000')
    .order('snapshot_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching snapshots:', error)
    process.exit(1)
  }

  if (!corruptSnapshots || corruptSnapshots.length === 0) {
    console.log('✅ No corrupt prices found! All data looks good.')
    return
  }

  console.log(`Found ${corruptSnapshots.length} snapshots with suspicious prices:\n`)

  // Group by currency to show patterns
  const byCurrency = {}
  corruptSnapshots.forEach(snap => {
    if (!byCurrency[snap.currency_code]) {
      byCurrency[snap.currency_code] = []
    }
    byCurrency[snap.currency_code].push(snap)
  })

  Object.entries(byCurrency).forEach(([curr, snaps]) => {
    console.log(`  ${curr}: ${snaps.length} snapshots`)
    const sample = snaps.slice(0, 3)
    sample.forEach(s => {
      console.log(`    - Ask: ${s.lowest_ask}, Bid: ${s.highest_bid}`)
    })
  })

  // Confirm before proceeding
  console.log(`\n⚠️  This will divide ${corruptSnapshots.length} prices by 100`)
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('📝 Step 2: Fixing prices...\n')

  let fixed = 0
  let errors = 0

  for (const snap of corruptSnapshots) {
    const updates = {}

    if (snap.lowest_ask && snap.lowest_ask > 1000) {
      updates.lowest_ask = Math.round((snap.lowest_ask / 100) * 100) / 100  // Divide by 100, round to 2 decimals
    }

    if (snap.highest_bid && snap.highest_bid > 1000) {
      updates.highest_bid = Math.round((snap.highest_bid / 100) * 100) / 100
    }

    if (Object.keys(updates).length === 0) {
      continue
    }

    const { error: updateError } = await supabase
      .from('stockx_market_snapshots')
      .update(updates)
      .eq('id', snap.id)

    if (updateError) {
      console.error(`❌ Error updating snapshot ${snap.id}:`, updateError)
      errors++
    } else {
      fixed++
      if (fixed % 10 === 0) {
        console.log(`  Fixed ${fixed}/${corruptSnapshots.length} snapshots...`)
      }
    }
  }

  console.log(`\n✅ Fixed ${fixed} snapshots`)
  if (errors > 0) {
    console.log(`❌ ${errors} errors encountered`)
  }

  // Refresh materialized view
  console.log('\n📊 Step 3: Refreshing stockx_market_latest materialized view...\n')

  const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

  if (refreshError) {
    console.error('❌ Error refreshing view:', refreshError)
    console.log('\nℹ️  You may need to refresh the view manually using:')
    console.log('   REFRESH MATERIALIZED VIEW CONCURRENTLY stockx_market_latest;')
  } else {
    console.log('✅ Materialized view refreshed successfully')
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Price unit fix complete!')
  console.log('\nNext steps:')
  console.log('1. Re-run diagnostic: node scripts/diagnose-stockx-prices.mjs')
  console.log('2. Check prices in your Portfolio table')
  console.log('3. If prices still wrong, run sync: POST /api/stockx/sync/inventory')
}

main().catch(console.error)
