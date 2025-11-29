#!/usr/bin/env node
/**
 * Clean up orphaned listings in stockx_listings that have NULL listing_id
 * These prevent items from being listed because the variant_id query finds them
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🧹 Cleaning up orphaned listings...\n')

// Find all orphaned listings (NULL listing_id with PENDING status)
const { data: orphaned, error } = await supabase
  .from('stockx_listings')
  .select('*')
  .is('stockx_listing_id', null)
  .eq('status', 'PENDING')

if (error) {
  console.error('❌ Error fetching orphaned listings:', error)
  process.exit(1)
}

console.log(`Found ${orphaned?.length || 0} orphaned listings\n`)

if (!orphaned || orphaned.length === 0) {
  console.log('✅ No orphaned listings to clean up')
  process.exit(0)
}

// Show what we're about to delete
console.log('Orphaned listings to delete:')
console.log('━'.repeat(80))
orphaned.forEach(listing => {
  console.log(`Variant: ${listing.stockx_variant_id}`)
  console.log(`  Product: ${listing.stockx_product_id}`)
  console.log(`  Amount: £${(listing.amount / 100).toFixed(2)}`)
  console.log(`  Status: ${listing.status}`)
  console.log(`  User: ${listing.user_id}`)
  console.log()
})

// Delete orphaned listings
const { error: deleteError } = await supabase
  .from('stockx_listings')
  .delete()
  .is('stockx_listing_id', null)
  .eq('status', 'PENDING')

if (deleteError) {
  console.error('❌ Failed to delete orphaned listings:', deleteError)
  process.exit(1)
}

console.log(`✅ Deleted ${orphaned.length} orphaned listings`)
console.log('\nYou should now be able to list these items on StockX!')
