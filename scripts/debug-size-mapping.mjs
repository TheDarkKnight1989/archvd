#!/usr/bin/env node
/**
 * Debug script to understand size mapping issues
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Debugging Size Mapping Issues\n')

// Check the problematic SKUs
const problematicSkus = ['IO3372-700', 'HQ6316', 'HQ6998-600', 'M2002RDA']

for (const sku of problematicSkus) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`SKU: ${sku}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  // Get inventory items (handle SKU variations with whitespace)
  const { data: allItems } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, size_us, size_eu')

  const items = allItems?.filter(item => item.sku?.trim() === sku.trim())

  console.log('\n📦 Inventory Items:')
  items?.forEach(item => {
    console.log(`   ID: ${item.id}`)
    console.log(`   UK: ${item.size_uk} | US: ${item.size_us} | EU: ${item.size_eu}`)
  })

  // Get market link mapping
  const { data: links } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, stockx_product_id, stockx_variant_id')
    .in('inventory_id', items?.map(i => i.id) || [])

  console.log('\n🔗 StockX Mappings:')
  links?.forEach(link => {
    console.log(`   Inventory: ${link.inventory_id}`)
    console.log(`   Product:   ${link.stockx_product_id}`)
    console.log(`   Variant:   ${link.stockx_variant_id}`)
  })

  // Get product info
  if (links && links.length > 0) {
    const { data: product } = await supabase
      .from('stockx_products')
      .select('stockx_product_id, brand, title, category')
      .eq('stockx_product_id', links[0].stockx_product_id)
      .single()

    console.log('\n👟 Product Info:')
    console.log(`   Brand: ${product?.brand}`)
    console.log(`   Title: ${product?.title}`)
    console.log(`   Category: ${product?.category}`)

    // Get variant info
    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('stockx_variant_id, variant_value')
      .eq('stockx_variant_id', links[0].stockx_variant_id)
      .single()

    console.log('\n📏 Mapped Variant:')
    console.log(`   Variant ID: ${variant?.stockx_variant_id}`)
    console.log(`   Size: ${variant?.variant_value}`)

    // Get current market data
    const { data: market } = await supabase
      .from('stockx_market_latest')
      .select('lowest_ask, highest_bid, currency_code')
      .eq('stockx_variant_id', links[0].stockx_variant_id)
      .eq('currency_code', 'GBP')
      .single()

    console.log('\n💰 Current Market Data:')
    console.log(`   Lowest Ask: £${market?.lowest_ask || 'N/A'}`)
    console.log(`   Highest Bid: £${market?.highest_bid || 'N/A'}`)
  }
}

console.log('\n\n✅ Debug complete')
