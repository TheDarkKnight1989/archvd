#!/usr/bin/env node
/**
 * Diagnose listing price display issue
 * Check what data is available and whether the join works
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🔍 Diagnosing listing data...\n')

// 1. Check inventory_market_links
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_listing_id, stockx_variant_id, updated_at')
  .not('stockx_listing_id', 'is', null)
  .limit(5)

console.log('📋 inventory_market_links (items with listing IDs):')
console.log('━'.repeat(80))
if (links && links.length > 0) {
  links.forEach(link => {
    console.log(`Item: ${link.item_id}`)
    console.log(`  Listing ID: ${link.stockx_listing_id}`)
    console.log(`  Variant ID: ${link.stockx_variant_id}`)
    console.log(`  Updated: ${link.updated_at}`)
    console.log()
  })
} else {
  console.log('❌ No links found with listing IDs')
}

// 2. Check stockx_listings table
const { data: listings } = await supabase
  .from('stockx_listings')
  .select('stockx_listing_id, stockx_variant_id, amount, currency_code, status, updated_at')
  .limit(5)
  .order('updated_at', { ascending: false })

console.log('\n💰 stockx_listings table:')
console.log('━'.repeat(80))
if (listings && listings.length > 0) {
  listings.forEach(listing => {
    console.log(`Listing ID: ${listing.stockx_listing_id || 'NULL'}`)
    console.log(`  Variant ID: ${listing.stockx_variant_id}`)
    console.log(`  Amount: ${listing.amount} cents (£${(listing.amount / 100).toFixed(2)})`)
    console.log(`  Currency: ${listing.currency_code}`)
    console.log(`  Status: ${listing.status}`)
    console.log(`  Updated: ${listing.updated_at}`)
    console.log()
  })
} else {
  console.log('❌ No listings found')
}

// 3. Check if we can join by variant_id
if (links && links.length > 0) {
  const variantIds = links.map(l => l.stockx_variant_id).filter(Boolean)

  if (variantIds.length > 0) {
    const { data: joinedData } = await supabase
      .from('stockx_listings')
      .select('stockx_variant_id, amount, currency_code, status')
      .in('stockx_variant_id', variantIds)

    console.log('\n🔗 JOIN TEST (by variant_id):')
    console.log('━'.repeat(80))
    console.log(`Querying for ${variantIds.length} variant IDs...`)

    if (joinedData && joinedData.length > 0) {
      console.log(`✅ Found ${joinedData.length} matching listings`)
      joinedData.forEach(listing => {
        console.log(`  Variant: ${listing.stockx_variant_id}`)
        console.log(`  Amount: £${(listing.amount / 100).toFixed(2)}`)
        console.log(`  Status: ${listing.status}`)
        console.log()
      })
    } else {
      console.log('❌ No matching listings found via variant_id join')
      console.log('\nThis is the problem! The join is failing.')
      console.log('\nVariant IDs we\'re looking for:')
      variantIds.forEach(id => console.log(`  - ${id}`))
    }
  }
}
