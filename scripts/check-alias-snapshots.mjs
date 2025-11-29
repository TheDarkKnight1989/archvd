#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Checking alias_market_snapshots table...\n')

const { data, error, count } = await supabase
  .from('alias_market_snapshots')
  .select('*', { count: 'exact' })
  .order('snapshot_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Found ${count} total snapshots in database`)
console.log(`\nLatest 10 snapshots:`)
if (data && data.length > 0) {
  data.forEach(s => {
    const lowestAsk = s.lowest_ask_cents ? `$${(s.lowest_ask_cents / 100).toFixed(2)}` : 'N/A'
    const highestBid = s.highest_bid_cents ? `$${(s.highest_bid_cents / 100).toFixed(2)}` : 'N/A'
    console.log(`  - ${s.catalog_id}`)
    console.log(`    Size ${s.size}: Ask ${lowestAsk} | Bid ${highestBid}`)
    console.log(`    Snapshot: ${s.snapshot_at}`)
  })
} else {
  console.log('  (no snapshots yet)')
}
