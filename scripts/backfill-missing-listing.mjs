#!/usr/bin/env node
/**
 * Backfill listings that exist in inventory_market_links but not in stockx_listings
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🔧 Backfilling missing listings...\n')

// Get all items with listing IDs in inventory_market_links
const { data: links, error: linksError } = await supabase
  .from('inventory_market_links')
  .select('*')
  .not('stockx_listing_id', 'is', null)

if (linksError) {
  console.error('❌ Failed to fetch links:', linksError)
  process.exit(1)
}

console.log(`Found ${links.length} items with listing IDs\n`)

let backfilled = 0
let skipped = 0
let errors = 0

for (const link of links) {
  // Check if already exists in stockx_listings
  const { data: existing } = await supabase
    .from('stockx_listings')
    .select('id')
    .eq('stockx_variant_id', link.stockx_variant_id)
    .eq('stockx_listing_id', link.stockx_listing_id)
    .single()

  if (existing) {
    console.log(`⏭️  Already exists: ${link.stockx_listing_id}`)
    skipped++
    continue
  }

  // Look up catalog IDs
  const { data: product } = await supabase
    .from('stockx_products')
    .select('id')
    .eq('stockx_product_id', link.stockx_product_id)
    .single()

  const { data: variant } = await supabase
    .from('stockx_variants')
    .select('id')
    .eq('stockx_variant_id', link.stockx_variant_id)
    .single()

  if (!product || !variant) {
    console.log(`⚠️  Missing catalog data for ${link.stockx_listing_id}`)
    errors++
    continue
  }

  // Get item details for user_id
  const { data: item } = await supabase
    .from('Inventory')
    .select('user_id')
    .eq('id', link.item_id)
    .single()

  if (!item) {
    console.log(`⚠️  Item not found: ${link.item_id}`)
    errors++
    continue
  }

  // Insert into stockx_listings
  const { error: insertError } = await supabase
    .from('stockx_listings')
    .insert({
      stockx_listing_id: link.stockx_listing_id,
      user_id: item.user_id,
      stockx_product_id: link.stockx_product_id,
      stockx_variant_id: link.stockx_variant_id,
      product_id: product.id,
      variant_id: variant.id,
      status: 'ACTIVE', // Assume active since it exists in inventory_market_links
      amount: 0, // We don't have the price, will be updated on next sync
      currency_code: 'GBP',
      created_at: link.updated_at,
      updated_at: link.updated_at,
    })

  if (insertError) {
    console.log(`❌ Failed to insert ${link.stockx_listing_id}:`, insertError.message)
    errors++
  } else {
    console.log(`✅ Backfilled: ${link.stockx_listing_id}`)
    backfilled++
  }
}

console.log('\n📊 Summary:')
console.log('━'.repeat(80))
console.log(`✅ Backfilled: ${backfilled}`)
console.log(`⏭️  Skipped (already exist): ${skipped}`)
console.log(`❌ Errors: ${errors}`)
