#!/usr/bin/env node
/**
 * Comprehensive size mapping diagnostic
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Size Mapping Diagnostic\n')

// Problem items from user feedback
const problems = [
  { sku: 'IO3372-700', expected_uk: '9', wrong_uk: '8' },
  { sku: 'HQ6316', expected_uk: '11', wrong_uk: '10.5' },
  { sku: 'HQ6998-600', expected_uk: ['9', '11'], wrong_uk: '?' },
  { sku: 'M2002RDA', expected_uk: '11.5', wrong_uk: '11' }
]

for (const problem of problems) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`SKU: ${problem.sku}`)
  console.log(`Expected UK Size: ${Array.isArray(problem.expected_uk) ? problem.expected_uk.join(', ') : problem.expected_uk}`)
  console.log(`User says system pulls: UK ${problem.wrong_uk}`)
  console.log('='.repeat(70))

  // Get inventory items (try exact match and trimmed variations)
  const { data: allItems } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, size_us, size_eu')

  const items = allItems.filter(item =>
    item.sku && item.sku.trim() === problem.sku.trim()
  )

  if (!items || items.length === 0) {
    console.log('❌ No inventory items found\n')
    continue
  }

  console.log(`\n📦 Found ${items.length} inventory item(s):`)

  for (const item of items) {
    console.log(`\n   Item ID: ${item.id}`)
    console.log(`   SKU: "${item.sku}"`)
    console.log(`   UK: ${item.size_uk} | US: ${item.size_us} | EU: ${item.size_eu}`)

    // Get market link
    const { data: links } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id, item_id')
      .eq('inventory_id', item.id)

    if (!links || links.length === 0) {
      console.log(`   ⚠️  No StockX mapping found`)
      continue
    }

    const link = links[0]
    console.log(`\n   🔗 StockX Mapping:`)
    console.log(`      Product ID: ${link.stockx_product_id}`)
    console.log(`      Variant ID: ${link.stockx_variant_id}`)

    // Get product info
    const { data: product } = await supabase
      .from('stockx_products')
      .select('brand, title, category')
      .eq('stockx_product_id', link.stockx_product_id)
      .single()

    if (product) {
      console.log(`\n   👟 Product: ${product.brand} - ${product.title}`)
      console.log(`      Category: ${product.category || 'N/A'}`)
    }

    // Get variant info
    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('variant_value')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .single()

    console.log(`\n   📏 Mapped Variant Size: ${variant?.variant_value || 'N/A'}`)
    console.log(`      ⚠️  ${variant?.variant_value === item.size_uk ? '✅ MATCHES' : '❌ MISMATCH'}`)

    // Get market data
    const { data: market } = await supabase
      .from('stockx_market_latest')
      .select('lowest_ask, highest_bid, currency_code')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .maybeSingle()

    if (market) {
      console.log(`\n   💰 Market Data (GBP):`)
      console.log(`      Lowest Ask: £${market.lowest_ask || 'N/A'}`)
      console.log(`      Highest Bid: £${market.highest_bid || 'N/A'}`)
    } else {
      console.log(`\n   ❌ No market data found for this variant`)
    }
  }
}

console.log('\n\n✅ Diagnostic complete')
