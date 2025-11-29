#!/usr/bin/env node

/**
 * Check specific snapshot data
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSnapshot() {
  const catalogId = 'wmns-dunk-low-cacao-wow-dd1503-124'
  const size = 6

  console.log(`\n=== SNAPSHOT FOR ${catalogId} SIZE ${size} ===\n`)

  const { data: snapshot, error } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .eq('catalog_id', catalogId)
    .eq('size', size)
    .single()

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!snapshot) {
    console.log('No snapshot found!')
    return
  }

  console.log('Raw database values:')
  console.log('  lowest_ask_cents:', snapshot.lowest_ask_cents, `($${snapshot.lowest_ask_cents / 100})`)
  console.log('  highest_bid_cents:', snapshot.highest_bid_cents, `($${snapshot.highest_bid_cents / 100})`)
  console.log('  last_sold_price_cents:', snapshot.last_sold_price_cents, `($${snapshot.last_sold_price_cents / 100})`)
  console.log('  snapshot_at:', snapshot.snapshot_at)
  console.log()

  console.log('UI Display (from hook):')
  console.log('  Market column (alias.lowestAsk) = lowest_ask_cents / 100 =', `$${snapshot.lowest_ask_cents / 100}`)
  console.log('  Highest Bid column (alias.highestBid) = highest_bid_cents / 100 =', `$${snapshot.highest_bid_cents / 100}`)
  console.log()

  console.log('Result:')
  if (snapshot.lowest_ask_cents >= snapshot.highest_bid_cents) {
    console.log('  ✓ Market >= Highest Bid (CORRECT)')
  } else {
    console.log('  ✗ Market < Highest Bid (WRONG - field mapping still reversed!)')
  }
}

checkSnapshot().catch(console.error)
