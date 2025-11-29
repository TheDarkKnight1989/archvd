#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkDB() {
  const catalogId = 'air-jordan-1-retro-high-og-dz5485-612'
  const size = 11  // UK 10 = US 11

  console.log('\n=== DATABASE CHECK: DZ5485-612 US 10 ===\n')
  console.log('Catalog ID:', catalogId)
  console.log('Size:', size)
  console.log()

  const { data, error } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .eq('catalog_id', catalogId)
    .eq('size', size)
    .order('snapshot_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('❌ No snapshot found in database')
    return
  }

  const snapshot = data[0]
  console.log('Latest snapshot:')
  console.log('  snapshot_at:', snapshot.snapshot_at)
  console.log('  currency:', snapshot.currency)
  console.log('  lowest_ask_cents:', snapshot.lowest_ask_cents, `→ $${snapshot.lowest_ask_cents / 100}`)
  console.log('  highest_bid_cents:', snapshot.highest_bid_cents, `→ $${snapshot.highest_bid_cents / 100}`)
  console.log('  last_sold_price_cents:', snapshot.last_sold_price_cents, `→ $${snapshot.last_sold_price_cents / 100}`)
  console.log()
  console.log('✅ This is what the UI should display')
}

checkDB().catch(console.error)
