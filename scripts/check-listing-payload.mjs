#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('\n🔍 Checking StockX listing payload...\n')

// Fetch the listing with the ID the user mentioned earlier
const { data, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('stockx_listing_id', '201dae39-05b6-489f-9fa7-c6deb0c93062')
  .single()

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('✅ Found listing:\n')
console.log('Listing ID:', data.stockx_listing_id)
console.log('Status:', data.stockx_listing_status)
console.log('\n📦 Payload structure:')
console.log('Has payload:', !!data.stockx_listing_payload)
console.log('Payload type:', typeof data.stockx_listing_payload)

if (data.stockx_listing_payload) {
  console.log('\n🔑 Payload keys:', Object.keys(data.stockx_listing_payload))
  console.log('\n📄 Full payload:')
  console.log(JSON.stringify(data.stockx_listing_payload, null, 2))
} else {
  console.log('\n⚠️  Payload is null or undefined')
}

console.log('\n')
