#!/usr/bin/env node
/**
 * Check what market data exists for the problematic items
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Market Data Investigation\n')

// Problem items from user feedback
const problemSkus = [
  { sku: 'IO3372-700', inventory_size_uk: '9', reported_wrong_size: '8' },
  { sku: 'HQ6316', inventory_size_uk: '11', reported_wrong_size: '10.5' },
  { sku: 'HQ6998-600', inventory_size_uk: ['9', '11'], reported_wrong_size: 'unknown' },
  { sku: 'M2002RDA', inventory_size_uk: '11.5', reported_wrong_size: '11' }
]

for (const problem of problemSkus) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`SKU: ${problem.sku}`)
  console.log(`Inventory Size(s): ${Array.isArray(problem.inventory_size_uk) ? problem.inventory_size_uk.join(', ') : problem.inventory_size_uk}`)
  console.log(`User reports wrong size: ${problem.reported_wrong_size}`)
  console.log('='.repeat(80))

  // Get inventory items
  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, size, size_uk')
    .ilike('sku', problem.sku)

  if (!items || items.length === 0) {
    console.log('❌ No inventory items found\n')
    continue
  }

  for (const item of items) {
    console.log(`\n📦 Item: ${item.sku} - Size UK ${item.size_uk}`)

    // Get market link
    const { data: links } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', item.id)

    if (!links || links.length === 0) {
      console.log('   ⚠️  No market link')
      continue
    }

    const link = links[0]
    console.log(`   🔗 Mapped to variant: ${link.stockx_variant_id}`)

    // Get variant info
    const { data: variant } = await supabase
      .from('stockx_variants')
      .select('variant_value, stockx_product_id')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .single()

    if (variant) {
      console.log(`   📏 Variant represents: UK ${variant.variant_value}`)
      console.log(`   ${variant.variant_value === item.size_uk ? '✅ Sizes match' : '❌ SIZE MISMATCH!'}`)
    }

    // Get market data for this variant
    const { data: marketData } = await supabase
      .from('stockx_market_latest')
      .select('stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_variant_id', link.stockx_variant_id)

    if (!marketData || marketData.length === 0) {
      console.log('   ❌ No market data found')
    } else {
      console.log(`\n   💰 Market Data (${marketData.length} entries):`)
      for (const data of marketData) {
        console.log(`      ${data.currency_code}: Ask £${data.lowest_ask}, Bid £${data.highest_bid}`)
      }
    }

    // Now check if there are OTHER variants for this product that have market data
    console.log(`\n   🔍 Checking OTHER variants for product ${link.stockx_product_id}:`)

    const { data: allVariants } = await supabase
      .from('stockx_variants')
      .select('stockx_variant_id, variant_value')
      .eq('stockx_product_id', link.stockx_product_id)
      .order('variant_value')

    if (allVariants && allVariants.length > 0) {
      console.log(`   Found ${allVariants.length} total variants for this product:`)

      for (const v of allVariants) {
        const { data: vMarket } = await supabase
          .from('stockx_market_latest')
          .select('currency_code, lowest_ask, highest_bid')
          .eq('stockx_variant_id', v.stockx_variant_id)
          .eq('currency_code', 'GBP')
          .maybeSingle()

        const hasMarketData = vMarket ? '💰' : '  '
        const isMatched = v.stockx_variant_id === link.stockx_variant_id ? '👈 MAPPED' : ''
        const marketInfo = vMarket ? `Ask £${vMarket.lowest_ask}, Bid £${vMarket.highest_bid}` : 'No market data'

        console.log(`      ${hasMarketData} UK ${v.variant_value} - ${marketInfo} ${isMatched}`)
      }
    }
  }
}

console.log('\n\n✅ Investigation complete\n')
