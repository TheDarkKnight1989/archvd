#!/usr/bin/env node

/**
 * Debug script to check inventory item data for listing display
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugInventoryDisplay() {
  console.log('\n🔍 Checking inventory items with listings...\n')

  // Get inventory items
  const { data: items, error: itemsError } = await supabase
    .from('Inventory')
    .select('id, sku')
    .limit(10)

  if (itemsError) {
    console.error('❌ Error fetching inventory:', itemsError)
    return
  }

  console.log(`Found ${items?.length || 0} inventory items\n`)

  // For each item, check the market links
  for (const item of items || []) {
    console.log(`\n📦 Item: ${item.sku}`)
    console.log(`   ID: ${item.id}`)

    // Check inventory_market_links
    const { data: link, error: linkError } = await supabase
      .from('inventory_market_links')
      .select('*')
      .eq('item_id', item.id)
      .single()

    if (linkError && linkError.code !== 'PGRST116') {
      console.error('   ❌ Error fetching link:', linkError.message)
      continue
    }

    if (!link) {
      console.log('   ℹ️  No market link found')
      continue
    }

    console.log(`   ✓ Market Link Found:`)
    console.log(`     - mapping_status: ${link.mapping_status}`)
    console.log(`     - product_id: ${link.product_id}`)
    console.log(`     - variant_id: ${link.variant_id}`)
    console.log(`     - stockx_listing_id: ${link.stockx_listing_id}`)

    // Check if there's a listing
    if (link.stockx_listing_id) {
      const { data: listing, error: listingError } = await supabase
        .from('stockx_listings')
        .select('*')
        .eq('stockx_listing_id', link.stockx_listing_id)
        .single()

      if (listingError) {
        console.error('   ❌ Error fetching listing:', listingError.message)
      } else {
        console.log(`   ✓ Listing Found:`)
        console.log(`     - status: ${listing.status}`)
        console.log(`     - amount: ${listing.amount} (${listing.amount / 100} in pounds)`)
        console.log(`     - expires_at: ${listing.expires_at}`)
      }
    }

    console.log(`\n   🎯 UI Display Logic:`)
    console.log(`     - Should show badge: ${link.mapping_status && link.mapping_status !== 'unmapped' ? 'YES ✓' : 'NO ✗'}`)
    console.log(`     - Condition check: mapping_status !== 'unmapped'`)
    console.log(`     - Actual value: mapping_status = '${link.mapping_status}'`)
  }

  console.log('\n')
}

debugInventoryDisplay().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
