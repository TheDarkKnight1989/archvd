#!/usr/bin/env node
/**
 * Diagnostic script to check StockX catalog state for mapped items
 * Helps identify why listings aren't being saved to database
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('🔍 Checking StockX catalog state for mapped items...\n')

  // Get all StockX mapped items
  const { data: mappedItems, error: mappedError } = await supabase
    .from('inventory_market_links')
    .select(`
      id,
      item_id,
      stockx_product_id,
      stockx_variant_id,
      listing_id,
      Inventory (
        sku,
        brand,
        model,
        colorway
      )
    `)
    .eq('marketplace', 'stockx')
    .not('stockx_product_id', 'is', null)

  if (mappedError) {
    console.error('❌ Error fetching mapped items:', mappedError)
    process.exit(1)
  }

  if (!mappedItems || mappedItems.length === 0) {
    console.log('ℹ️  No StockX-mapped items found')
    process.exit(0)
  }

  console.log(`📦 Found ${mappedItems.length} StockX-mapped items\n`)

  let missingProducts = 0
  let missingVariants = 0
  let complete = 0

  for (const item of mappedItems) {
    const inventory = item.Inventory
    const itemName = inventory
      ? `${inventory.brand || ''} ${inventory.model || ''} ${inventory.colorway || ''}`.trim() || 'Unknown Item'
      : 'Unknown Item'

    console.log(`\n📍 Item: ${itemName}`)
    console.log(`   Inventory ID: ${item.item_id}`)
    console.log(`   StockX Product ID: ${item.stockx_product_id}`)
    console.log(`   StockX Variant ID: ${item.stockx_variant_id}`)

    // Check if product exists in catalog
    const { data: product, error: productError } = await supabase
      .from('stockx_products')
      .select('id, title, style_id')
      .eq('stockx_product_id', item.stockx_product_id)
      .single()

    if (productError || !product) {
      console.log(`   ❌ Product NOT in catalog (stockx_products table)`)
      missingProducts++
    } else {
      console.log(`   ✅ Product found: ${product.title || product.style_id || product.id}`)
    }

    // Check if variant exists in catalog
    const { data: variant, error: variantError } = await supabase
      .from('stockx_variants')
      .select('id, size')
      .eq('stockx_variant_id', item.stockx_variant_id)
      .single()

    if (variantError || !variant) {
      console.log(`   ❌ Variant NOT in catalog (stockx_variants table)`)
      missingVariants++
    } else {
      console.log(`   ✅ Variant found: Size ${variant.size || 'Unknown'}`)
    }

    if (product && variant) {
      complete++
      console.log(`   ✅ Ready for listing creation`)
    } else {
      console.log(`   ⚠️  CANNOT create listing - missing catalog data`)
    }

    // Check if listing exists
    if (item.listing_id) {
      const { data: listing, error: listingError } = await supabase
        .from('stockx_listings')
        .select('id, stockx_listing_id, amount, currency_code, status')
        .eq('stockx_listing_id', item.listing_id)
        .single()

      if (listing) {
        console.log(`   📋 Listing exists: ${listing.stockx_listing_id} (${listing.status})`)
      } else {
        console.log(`   ⚠️  Listing ID in link (${item.listing_id}) but not in stockx_listings table`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total mapped items: ${mappedItems.length}`)
  console.log(`✅ Complete (ready for listings): ${complete}`)
  console.log(`❌ Missing products in catalog: ${missingProducts}`)
  console.log(`❌ Missing variants in catalog: ${missingVariants}`)

  if (missingProducts > 0 || missingVariants > 0) {
    console.log('\n⚠️  ROOT CAUSE IDENTIFIED:')
    console.log('Items are mapped but products/variants are not in the catalog tables.')
    console.log('This causes the listing creation to skip the database insert.')
    console.log('\n💡 SOLUTION:')
    console.log('Need to populate stockx_products and stockx_variants tables during mapping.')
  } else {
    console.log('\n✅ All mapped items have complete catalog data.')
    console.log('Listings should be working. Check for other issues.')
  }
}

diagnose().catch(console.error)
