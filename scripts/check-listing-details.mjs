#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('\n🔍 Checking listing details...\n')

const { data, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('stockx_listing_id', '201dae39-05b6-489f-9fa7-c6deb0c93062')
  .single()

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('✅ Full listing record:\n')
console.log(JSON.stringify(data, null, 2))
console.log('\n')

// Check how many listings this user has total
const { data: allListings, error: allError } = await supabase
  .from('inventory_market_links')
  .select('stockx_listing_id, stockx_listing_status, stockx_listing_payload')
  .eq('user_id', data.user_id)
  .not('stockx_listing_id', 'is', null)
  .limit(10)

if (!allError) {
  console.log(`\n📊 Sample of user's listings (first 10):`)
  allListings.forEach((listing, i) => {
    console.log(`${i + 1}. ID: ${listing.stockx_listing_id} | Status: ${listing.stockx_listing_status} | Has Payload: ${!!listing.stockx_listing_payload}`)
  })
  console.log('\n')
}
