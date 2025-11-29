#!/usr/bin/env node
/**
 * Check what's preventing the duplicated item from showing "List on StockX"
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('🔍 Checking for duplicate item issues...\n')

// Find items with the same SKU that might be duplicates
const { data: items } = await supabase
  .from('Inventory')
  .select('id, sku, status, created_at')
  .order('created_at', { ascending: false })
  .limit(10)

console.log('📦 Recent inventory items:')
console.log('━'.repeat(80))
items?.forEach(item => {
  console.log(`ID: ${item.id}`)
  console.log(`  SKU: ${item.sku}`)
  console.log(`  Status: ${item.status}`)
  console.log(`  Created: ${item.created_at}`)
  console.log()
})

// Check their mappings
console.log('\n🔗 Checking inventory_market_links for these items:')
console.log('━'.repeat(80))

for (const item of items || []) {
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', item.id)
    .single()

  if (link) {
    console.log(`Item ${item.id} (${item.sku}):`)
    console.log(`  Has mapping: ✅`)
    console.log(`  Listing ID: ${link.stockx_listing_id || 'NULL'}`)
    console.log(`  Variant ID: ${link.stockx_variant_id}`)
    console.log(`  Product ID: ${link.stockx_product_id}`)

    // Check if there's a listing in stockx_listings
    if (link.stockx_variant_id) {
      const { data: listing } = await supabase
        .from('stockx_listings')
        .select('stockx_listing_id, status, amount')
        .eq('stockx_variant_id', link.stockx_variant_id)
        .single()

      if (listing) {
        console.log(`  Cache listing: ✅ (status: ${listing.status}, amount: £${(listing.amount / 100).toFixed(2)})`)
      } else {
        console.log(`  Cache listing: ❌ (not in stockx_listings)`)
      }
    }

    console.log()
  } else {
    console.log(`Item ${item.id} (${item.sku}): No mapping`)
    console.log()
  }
}

// Look for duplicate SKUs specifically
console.log('\n🔎 Looking for duplicate SKUs:')
console.log('━'.repeat(80))

const { data: allItems } = await supabase
  .from('Inventory')
  .select('id, sku, status, created_at')
  .order('created_at', { ascending: false })

const skuMap = new Map()
allItems?.forEach(item => {
  if (!skuMap.has(item.sku)) {
    skuMap.set(item.sku, [])
  }
  skuMap.get(item.sku).push(item)
})

for (const [sku, items] of skuMap) {
  if (items.length > 1) {
    console.log(`SKU ${sku} has ${items.length} items:`)
    items.forEach(item => {
      console.log(`  - ID: ${item.id}, Status: ${item.status}, Created: ${item.created_at}`)
    })
    console.log()
  }
}
