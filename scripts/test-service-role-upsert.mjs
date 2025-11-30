#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

console.log('\n🧪 Testing service role upsert...\n')
console.log('Using service role key:', supabaseServiceKey.substring(0, 20) + '...')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const testUpdate = {
  id: 'd325c4df-a5b0-4fb7-bc26-168a935dc705',
  stockx_listing_status: 'ACTIVE',
  stockx_last_listing_sync_at: new Date().toISOString(),
  stockx_listing_payload: { test: 'payload', amount: 12345, currencyCode: 'GBP' }
}

console.log('Attempting upsert with payload:', JSON.stringify(testUpdate, null, 2))

const { data, error } = await supabase
  .from('inventory_market_links')
  .upsert(testUpdate, { onConflict: 'id' })
  .select()

if (error) {
  console.error('\n❌ Upsert failed:', error)
} else {
  console.log('\n✅ Upsert succeeded!')
  console.log('Result:', data)
}

console.log('\n')
