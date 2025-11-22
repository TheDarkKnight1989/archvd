#!/usr/bin/env node
/**
 * Investigate size mapping issues for specific SKUs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Size Mapping Investigation\n')

// Problem items from user feedback
const problemSkus = [
  { sku: 'IO3372-700', expected_uk: '9', wrong_uk: '8' },
  { sku: 'HQ6316', expected_uk: '11', wrong_uk: '10.5' },
  { sku: 'HQ6998-600', expected_uk: 'unknown', wrong_uk: 'wrong data' },
  { sku: 'M2002RDA', expected_uk: '11.5', wrong_uk: '11' }
]

const results = []

for (const problem of problemSkus) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`SKU: ${problem.sku}`)
  console.log(`Expected UK Size: ${problem.expected_uk}`)
  console.log(`User reports system pulls: UK ${problem.wrong_uk}`)
  console.log('='.repeat(80))

  // Get inventory items
  const { data: items, error: itemsError } = await supabase
    .from('Inventory')
    .select('id, sku, size, size_uk, size_alt')
    .ilike('sku', problem.sku)

  if (itemsError) {
    console.log('❌ Error fetching inventory:', itemsError.message)
    continue
  }

  if (!items || items.length === 0) {
    console.log('❌ No inventory items found\n')
    continue
  }

  console.log(`\n📦 Found ${items.length} inventory item(s):`)

  for (const item of items) {
    const itemResult = {
      sku: problem.sku,
      inventory_id: item.id,
      inventory_size: item.size,
      inventory_size_uk: item.size_uk,
      inventory_size_alt: item.size_alt,
      expected_uk: problem.expected_uk,
      reported_wrong_uk: problem.wrong_uk
    }

    console.log(`\n   Item ID: ${item.id}`)
    console.log(`   SKU: "${item.sku}"`)
    console.log(`   Size: ${item.size} | UK: ${item.size_uk} | Alt: ${item.size_alt}`)

    // Get market link
    const { data: links, error: linksError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id, item_id')
      .eq('item_id', item.id)

    if (linksError) {
      console.log(`   ❌ Error fetching market links:`, linksError.message)
      continue
    }

    if (!links || links.length === 0) {
      console.log(`   ⚠️  No StockX mapping found`)
      itemResult.has_mapping = false
      results.push(itemResult)
      continue
    }

    const link = links[0]
    itemResult.has_mapping = true
    itemResult.stockx_product_id = link.stockx_product_id
    itemResult.stockx_variant_id = link.stockx_variant_id

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
      itemResult.product_brand = product.brand
      itemResult.product_title = product.title
      itemResult.product_category = product.category
      console.log(`\n   👟 Product: ${product.brand} - ${product.title}`)
      console.log(`      Category: ${product.category || 'N/A'}`)
    }

    // Get variant info
    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('variant_value')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .single()

    if (variant) {
      itemResult.variant_size = variant.variant_value
      const isMatch = variant.variant_value === item.size_uk
      itemResult.is_match = isMatch

      console.log(`\n   📏 Mapped Variant Size: ${variant.variant_value}`)
      console.log(`      ${isMatch ? '✅ MATCHES inventory size' : '❌ MISMATCH - inventory has UK ' + item.size_uk}`)
    } else {
      console.log(`\n   ❌ Variant not found in stockx_variants table`)
      itemResult.variant_size = null
      itemResult.is_match = false
    }

    // Get market data
    const { data: market } = await supabase
      .from('stockx_market_latest')
      .select('lowest_ask, highest_bid, currency_code')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .maybeSingle()

    if (market) {
      itemResult.has_market_data = true
      itemResult.lowest_ask = market.lowest_ask
      itemResult.highest_bid = market.highest_bid
      console.log(`\n   💰 Market Data (GBP):`)
      console.log(`      Lowest Ask: £${market.lowest_ask || 'N/A'}`)
      console.log(`      Highest Bid: £${market.highest_bid || 'N/A'}`)
    } else {
      itemResult.has_market_data = false
      console.log(`\n   ❌ No market data found for this variant`)
    }

    results.push(itemResult)
  }
}

// Summary report
console.log('\n\n' + '='.repeat(80))
console.log('📊 SUMMARY REPORT')
console.log('='.repeat(80))

for (const result of results) {
  console.log(`\nSKU: ${result.sku}`)
  console.log(`  Inventory Size (UK): ${result.inventory_size_uk}`)
  console.log(`  Expected Size (UK): ${result.expected_uk}`)
  console.log(`  Mapped Variant Size: ${result.variant_size || 'N/A'}`)
  console.log(`  Status: ${result.is_match ? '✅ CORRECT' : '❌ MISMATCH'}`)

  if (!result.is_match && result.variant_size) {
    console.log(`  Problem: System pulling data for UK ${result.variant_size}, but inventory has UK ${result.inventory_size_uk}`)
  }
}

console.log('\n✅ Investigation complete\n')
