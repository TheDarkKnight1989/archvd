#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const listingId = '11c346bd-e1a0-43f5-b38b-bedce8191ad9'
const itemId = 'f115e948-a75d-40ee-8b65-eb62ebbc2f47'

console.log('🔍 Checking listing:', listingId, '\n')

// Get mapping
const { data: mapping } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('item_id', itemId)
  .single()

console.log('📋 Mapping:')
console.log('  Listing ID:', mapping?.stockx_listing_id)
console.log('  Variant ID:', mapping?.stockx_variant_id)
console.log('  Product ID:', mapping?.stockx_product_id)

// Check stockx_listings by listing_id
const { data: byListingId } = await supabase
  .from('stockx_listings')
  .select('*')
  .eq('stockx_listing_id', listingId)

console.log('\n💰 In stockx_listings (by listing_id):')
if (byListingId && byListingId.length > 0) {
  console.log('  ✅ FOUND')
  byListingId.forEach(l => {
    console.log('  Amount:', l.amount, 'cents (£' + (l.amount / 100).toFixed(2) + ')')
    console.log('  Status:', l.status)
    console.log('  Variant:', l.stockx_variant_id)
  })
} else {
  console.log('  ❌ NOT FOUND')
}

// Check stockx_listings by variant_id
if (mapping?.stockx_variant_id) {
  const { data: byVariantId } = await supabase
    .from('stockx_listings')
    .select('*')
    .eq('stockx_variant_id', mapping.stockx_variant_id)

  console.log('\n💰 In stockx_listings (by variant_id):')
  if (byVariantId && byVariantId.length > 0) {
    console.log('  ✅ FOUND')
    byVariantId.forEach(l => {
      console.log('  Listing ID:', l.stockx_listing_id || 'NULL')
      console.log('  Amount:', l.amount, 'cents (£' + (l.amount / 100).toFixed(2) + ')')
      console.log('  Status:', l.status)
    })
  } else {
    console.log('  ❌ NOT FOUND')
  }
}
