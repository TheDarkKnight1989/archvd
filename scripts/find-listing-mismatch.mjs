#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🔍 Finding listing data mismatch...\n')

// Get the listing from inventory_market_links
const { data: link } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_listing_id, stockx_variant_id, updated_at')
  .eq('stockx_listing_id', '87d65adb-115d-426b-ba56-2150f3a4e996')
  .single()

if (!link) {
  console.log('❌ Listing not found in inventory_market_links')
  process.exit(1)
}

console.log('📋 inventory_market_links:')
console.log('━'.repeat(80))
console.log(`Item ID: ${link.item_id}`)
console.log(`Listing ID: ${link.stockx_listing_id}`)
console.log(`Variant ID: ${link.stockx_variant_id}`)
console.log(`Updated: ${link.updated_at}`)

// Check if this listing exists in stockx_listings by listing_id
const { data: byListingId } = await supabase
  .from('stockx_listings')
  .select('*')
  .eq('stockx_listing_id', link.stockx_listing_id)
  .single()

console.log('\n💰 stockx_listings (by listing_id):')
console.log('━'.repeat(80))
if (byListingId) {
  console.log('✅ Found by listing_id')
  console.log(`  stockx_listing_id: ${byListingId.stockx_listing_id}`)
  console.log(`  stockx_variant_id: ${byListingId.stockx_variant_id}`)
  console.log(`  amount: £${(byListingId.amount / 100).toFixed(2)}`)
  console.log(`  status: ${byListingId.status}`)
} else {
  console.log('❌ NOT found by listing_id')
}

// Check if this listing exists in stockx_listings by variant_id
const { data: byVariantId } = await supabase
  .from('stockx_listings')
  .select('*')
  .eq('stockx_variant_id', link.stockx_variant_id)
  .single()

console.log('\n💰 stockx_listings (by variant_id):')
console.log('━'.repeat(80))
if (byVariantId) {
  console.log('✅ Found by variant_id')
  console.log(`  stockx_listing_id: ${byVariantId.stockx_listing_id || 'NULL'}`)
  console.log(`  stockx_variant_id: ${byVariantId.stockx_variant_id}`)
  console.log(`  amount: £${(byVariantId.amount / 100).toFixed(2)}`)
  console.log(`  status: ${byVariantId.status}`)
} else {
  console.log('❌ NOT found by variant_id')
}

// Show all listings
const { data: allListings } = await supabase
  .from('stockx_listings')
  .select('stockx_listing_id, stockx_variant_id, amount, status')
  .limit(10)

console.log('\n📊 ALL stockx_listings:')
console.log('━'.repeat(80))
allListings?.forEach(l => {
  console.log(`Listing: ${l.stockx_listing_id || 'NULL'} | Variant: ${l.stockx_variant_id} | £${(l.amount / 100).toFixed(2)} | ${l.status}`)
})
