#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🧹 Cleaning up MISSING listings...\n')

// Find all links that have a listing_id but status is MISSING
const { data: links, error } = await supabase
  .from('inventory_market_links')
  .select('id, item_id, stockx_listing_id, stockx_listing_status')
  .not('stockx_listing_id', 'is', null)
  .eq('stockx_listing_status', 'MISSING')

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Found ${links.length} MISSING listings with non-null listing_id\n`)

if (links.length === 0) {
  console.log('✅ No cleanup needed!')
  process.exit(0)
}

// Clear listing_id for all MISSING listings
const { error: updateError } = await supabase
  .from('inventory_market_links')
  .update({ stockx_listing_id: null })
  .eq('stockx_listing_status', 'MISSING')

if (updateError) {
  console.error('❌ Update error:', updateError.message)
  process.exit(1)
}

console.log(`✅ Cleared listing_id for ${links.length} MISSING listings`)
console.log('\nThese items will no longer show as "Listed" in the Portfolio.\n')
