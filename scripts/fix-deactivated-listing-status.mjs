#!/usr/bin/env node
/**
 * Fix Status for Deactivated Listing
 * Updates stockx_listings table to match inventory_market_links
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const listingId = '6df95d08-f555-4d6b-ae98-31339c4bd957'

console.log(`\n🔧 Fixing status for listing: ${listingId}\n`)

// Update stockx_listings table
const { error } = await supabase
  .from('stockx_listings')
  .update({
    status: 'INACTIVE',
    updated_at: new Date().toISOString(),
  })
  .eq('stockx_listing_id', listingId)

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('✅ Successfully updated stockx_listings.status to INACTIVE')

// Verify the update
const { data } = await supabase
  .from('stockx_listings')
  .select('stockx_listing_id, status')
  .eq('stockx_listing_id', listingId)
  .single()

console.log('\n📊 Current status:', data)
