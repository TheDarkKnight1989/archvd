#!/usr/bin/env node
/**
 * Check for duplicate mappings where multiple items map to the same variant
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🔍 Checking for duplicate variant mappings...\n')

// Get all mappings
const { data: allMappings } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_variant_id, stockx_listing_id')
  .not('stockx_variant_id', 'is', null)

console.log(`Total mappings: ${allMappings?.length || 0}\n`)

// Group by variant_id
const variantMap = new Map()
allMappings?.forEach(mapping => {
  if (!variantMap.has(mapping.stockx_variant_id)) {
    variantMap.set(mapping.stockx_variant_id, [])
  }
  variantMap.get(mapping.stockx_variant_id).push(mapping)
})

// Find duplicates
const duplicates = []
for (const [variantId, mappings] of variantMap) {
  if (mappings.length > 1) {
    duplicates.push({ variantId, mappings })
  }
}

if (duplicates.length === 0) {
  console.log('✅ No duplicate variant mappings found')
  process.exit(0)
}

console.log(`⚠️  Found ${duplicates.length} variants mapped to multiple items:\n`)
console.log('━'.repeat(80))

for (const { variantId, mappings } of duplicates) {
  console.log(`\n🔸 Variant: ${variantId}`)
  console.log(`   ${mappings.length} items mapped to this variant:\n`)

  for (const mapping of mappings) {
    // Get item details
    const { data: item } = await supabase
      .from('Inventory')
      .select('id, sku, status, created_at')
      .eq('id', mapping.item_id)
      .single()

    if (item) {
      console.log(`   📦 Item ${item.id}`)
      console.log(`      SKU: ${item.sku}`)
      console.log(`      Status: ${item.status}`)
      console.log(`      Listing ID: ${mapping.stockx_listing_id || 'NULL'}`)
      console.log(`      Created: ${item.created_at || 'N/A'}`)
    }
  }

  // Check if there's a listing for this variant
  const { data: listing } = await supabase
    .from('stockx_listings')
    .select('stockx_listing_id, status, amount')
    .eq('stockx_variant_id', variantId)
    .single()

  if (listing) {
    console.log(`\n   💰 Cache listing: ${listing.stockx_listing_id || 'NULL'}`)
    console.log(`      Status: ${listing.status}`)
    console.log(`      Amount: £${(listing.amount / 100).toFixed(2)}`)
  }

  console.log('\n' + '━'.repeat(80))
}

console.log('\n⚠️  PROBLEM: When multiple items share the same variant_id,')
console.log('   they all get the same listing status, preventing duplicates from being listed.')
