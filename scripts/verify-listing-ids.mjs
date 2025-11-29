#!/usr/bin/env node
/**
 * Verify that StockX listing IDs are properly saved
 * Shows items with StockX mappings and their listing status
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function verifyListingIds() {
  console.log('🔍 Checking StockX listing IDs...\n')

  // Get all items with StockX mappings
  const { data: items, error } = await supabase
    .from('inventory')
    .select(`
      id,
      brand,
      model,
      colorway,
      size,
      inventory_market_links!inner(
        stockx_product_id,
        stockx_variant_id,
        stockx_listing_id
      )
    `)
    .not('inventory_market_links.stockx_product_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  if (items.length === 0) {
    console.log('No items with StockX mappings found')
    return
  }

  console.log(`Found ${items.length} items with StockX mappings:\n`)

  let listedCount = 0
  let unmappedCount = 0

  for (const item of items) {
    const link = item.inventory_market_links[0]
    const hasListing = !!link?.stockx_listing_id

    if (hasListing) {
      listedCount++
      console.log(`✅ ${item.brand} ${item.model} - Size ${item.size}`)
      console.log(`   Listing ID: ${link.stockx_listing_id}`)
      console.log(`   Item ID: ${item.id}`)
    } else {
      unmappedCount++
      console.log(`⚪ ${item.brand} ${item.model} - Size ${item.size}`)
      console.log(`   No listing (mapped but not listed)`)
      console.log(`   Item ID: ${item.id}`)
    }
    console.log()
  }

  console.log('━'.repeat(60))
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Listed on StockX: ${listedCount}`)
  console.log(`   ⚪ Mapped but not listed: ${unmappedCount}`)
  console.log()

  if (listedCount > 0) {
    console.log('✅ Listing IDs are being saved correctly!')
    console.log(`\n💡 You can update listings using:`)
    console.log(`   PATCH https://api.stockx.com/v2/selling/listings/{listingId}`)
  }

  if (unmappedCount > 0) {
    console.log(`\n💡 ${unmappedCount} items are mapped but not listed yet.`)
    console.log(`   Create listings for them through the UI.`)
  }
}

verifyListingIds().catch(console.error)
