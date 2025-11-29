#!/usr/bin/env node
/**
 * Backfill script to update inventory_market_links with existing listing IDs
 * This fixes the 3 orphaned listings that were created before the bug fix
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔧 Backfilling listing links...\n')

// Get all listings that don't have a link
const { data: listings, error: listingsError } = await supabase
  .from('stockx_listings')
  .select('stockx_listing_id, stockx_product_id, stockx_variant_id, created_at')
  .order('created_at', { ascending: false })

if (listingsError) {
  console.error('❌ Error fetching listings:', listingsError)
  process.exit(1)
}

console.log(`Found ${listings.length} listings to check\n`)

let updatedCount = 0
let skippedCount = 0

for (const listing of listings) {
  // Find the matching inventory_market_link
  const { data: link, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('stockx_product_id', listing.stockx_product_id)
    .eq('stockx_variant_id', listing.stockx_variant_id)
    .single()

  if (linkError || !link) {
    console.log(`⚠️  Listing ${listing.stockx_listing_id}: No matching inventory link found`)
    skippedCount++
    continue
  }

  // Check if link already has a listing_id
  if (link.stockx_listing_id) {
    console.log(`✓ Listing ${listing.stockx_listing_id}: Already linked`)
    skippedCount++
    continue
  }

  // Update the link
  const { error: updateError } = await supabase
    .from('inventory_market_links')
    .update({
      stockx_listing_id: listing.stockx_listing_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', link.id)

  if (updateError) {
    console.error(`❌ Failed to update link for listing ${listing.stockx_listing_id}:`, updateError)
  } else {
    console.log(`✅ Updated link for listing ${listing.stockx_listing_id}`)
    console.log(`   Item ID: ${link.item_id}`)
    console.log(`   Created: ${new Date(listing.created_at).toLocaleString()}\n`)
    updatedCount++
  }
}

console.log('=' .repeat(70))
console.log('📊 BACKFILL SUMMARY')
console.log('=' .repeat(70))
console.log(`Total listings checked: ${listings.length}`)
console.log(`✅ Links updated: ${updatedCount}`)
console.log(`⏭️  Skipped (already linked or no match): ${skippedCount}`)

if (updatedCount > 0) {
  console.log('\n✅ Backfill complete! Listings should now be visible in the UI.')
  console.log('   Refresh your browser to see the updates.')
} else {
  console.log('\nℹ️  No updates needed.')
}
