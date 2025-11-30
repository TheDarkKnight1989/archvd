#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 Checking all listings for payload data...\n')

const { data, error } = await supabase
  .from('inventory_market_links')
  .select('id, stockx_listing_id, stockx_listing_status, stockx_listing_payload, stockx_last_listing_sync_at')
  .not('stockx_listing_id', 'is', null)
  .order('stockx_last_listing_sync_at', { ascending: false })
  .limit(20)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Found ${data.length} listings with StockX IDs\n`)

let withPayload = 0
let withoutPayload = 0

data.forEach((listing, i) => {
  const hasPayload = !!listing.stockx_listing_payload
  const icon = hasPayload ? '✅' : '❌'

  if (hasPayload) {
    withPayload++
    console.log(`${icon} ${i + 1}. ID: ${listing.stockx_listing_id}`)
    console.log(`   Status: ${listing.stockx_listing_status}`)
    console.log(`   Last Sync: ${listing.stockx_last_listing_sync_at}`)
    console.log(`   Ask Price: ${listing.stockx_listing_payload?.amount || 'N/A'}`)
    console.log('')
  } else {
    withoutPayload++
  }
})

console.log(`\n📈 Summary:`)
console.log(`   ✅ With payload: ${withPayload}`)
console.log(`   ❌ Without payload: ${withoutPayload}`)
console.log('')
