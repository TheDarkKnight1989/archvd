#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSnapshots() {
  console.log('\n=== ALL ALIAS MARKET SNAPSHOTS ===\n')
  
  const { data, error } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('❌ No snapshots found in database')
    return
  }

  console.log(`Found ${data.length} snapshots:\n`)
  
  for (const snapshot of data) {
    console.log(`Catalog: ${snapshot.catalog_id}`)
    console.log(`  Size: ${snapshot.size} US`)
    console.log(`  Lowest Ask: $${snapshot.lowest_ask_cents / 100}`)
    console.log(`  Highest Bid: $${snapshot.highest_bid_cents / 100}`)
    console.log(`  Last Sold: $${snapshot.last_sold_price_cents / 100}`)
    console.log(`  Snapshot At: ${snapshot.snapshot_at}`)
    console.log()
  }
}

checkSnapshots().catch(console.error)
