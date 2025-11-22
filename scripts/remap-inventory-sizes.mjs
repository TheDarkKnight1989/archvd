#!/usr/bin/env node
/**
 * Re-map inventory items with correct size conversions
 *
 * Problem: StockX variant_value uses US sizes, but inventory uses UK sizes
 * Solution: Convert UK → US using brand-specific charts, then find correct variant
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Size conversion charts
const NIKE_MENS_UK_TO_US = {
  3: 3.5, 3.5: 4.5, 4: 5, 4.5: 5.5, 5: 6, 5.5: 6.5, 6: 7, 6.5: 7.5,
  7: 8, 7.5: 8.5, 8: 9, 8.5: 9.5, 9: 10, 9.5: 10.5, 10: 11, 10.5: 11.5,
  11: 12, 11.5: 12.5, 12: 13, 13: 14, 14: 15, 15: 16, 16: 17, 17: 18,
}

const ADIDAS_MENS_UK_TO_US = {
  3.5: 4, 4: 4.5, 4.5: 5, 5: 5.5, 5.5: 6, 6: 6.5, 6.5: 7, 7: 7.5, 7.5: 8,
  8: 8.5, 8.5: 9, 9: 9.5, 9.5: 10, 10: 10.5, 10.5: 11, 11: 11.5, 11.5: 12,
  12: 12.5, 12.5: 13, 13.5: 14, 14.5: 15,
}

const NEW_BALANCE_MENS_UK_TO_US = {
  3.5: 4, 4: 4.5, 4.5: 5, 5: 5.5, 5.5: 6, 6: 6.5, 6.5: 7, 7: 7.5, 7.5: 8,
  8: 8.5, 8.5: 9, 9: 9.5, 9.5: 10, 10: 10.5, 10.5: 11, 11: 11.5, 11.5: 12,
  12: 12.5, 12.5: 13, 13: 14, 14: 15, 15: 16,
}

function detectBrand(brandName, productTitle) {
  const text = `${brandName || ''} ${productTitle || ''}`.toLowerCase()
  if (text.includes('jordan')) return 'jordan'
  if (text.includes('nike')) return 'nike'
  if (text.includes('yeezy') || text.includes('adidas')) return 'adidas'
  if (text.includes('new balance')) return 'new-balance'
  return 'nike' // default
}

function convertUkToUs(ukSize, brand) {
  const charts = {
    nike: NIKE_MENS_UK_TO_US,
    jordan: NIKE_MENS_UK_TO_US,
    adidas: ADIDAS_MENS_UK_TO_US,
    yeezy: ADIDAS_MENS_UK_TO_US,
    'new-balance': NEW_BALANCE_MENS_UK_TO_US,
  }

  const chart = charts[brand] || NIKE_MENS_UK_TO_US
  return chart[ukSize] || null
}

console.log('🔄 Starting inventory size re-mapping...\n')

try {
  // Get all inventory items
  const { data: items, error: fetchError } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk')
    .not('size_uk', 'is', null)

  if (fetchError) throw fetchError

  // Get all market links
  const { data: links, error: linksError } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .in('item_id', items.map(i => i.id))

  if (linksError) throw linksError

  // Combine the data
  const mappedItems = items
    .map(item => {
      const link = links.find(l => l.item_id === item.id)
      return link ? { ...item, link } : null
    })
    .filter(Boolean)

  console.log(`Found ${mappedItems.length} items to check\n`)

  let totalChecked = 0
  let totalRemapped = 0
  let totalCorrect = 0
  let totalFailed = 0

  for (const item of mappedItems) {
    totalChecked++
    const link = item.link

    console.log(`\n${totalChecked}. ${item.sku} - UK ${item.size_uk}`)
    console.log(`   Current variant: ${link.stockx_variant_id}`)

    // Get product info
    const { data: product } = await supabase
      .from('stockx_products')
      .select('brand, title')
      .eq('stockx_product_id', link.stockx_product_id)
      .single()

    if (!product) {
      console.log(`   ⚠️  Product not found - skipping`)
      totalFailed++
      continue
    }

    // Detect brand and convert size
    const brand = detectBrand(product.brand, product.title)
    const usSize = convertUkToUs(parseFloat(item.size_uk), brand)

    if (!usSize) {
      console.log(`   ⚠️  Cannot convert UK ${item.size_uk} for ${brand} - skipping`)
      totalFailed++
      continue
    }

    console.log(`   Brand: ${brand}`)
    console.log(`   UK ${item.size_uk} → US ${usSize}`)

    // Get current variant
    const { data: currentVariant } = await supabase
      .from('stockx_variants')
      .select('variant_value')
      .eq('stockx_variant_id', link.stockx_variant_id)
      .single()

    const currentSize = currentVariant?.variant_value || 'unknown'
    console.log(`   Current variant size: ${currentSize} (US)`)

    // Check if it's already correct
    if (parseFloat(currentSize) === usSize) {
      console.log(`   ✅ Already correct!`)
      totalCorrect++
      continue
    }

    // Find all variants for this product
    const { data: allVariants } = await supabase
      .from('stockx_variants')
      .select('stockx_variant_id, variant_value')
      .eq('stockx_product_id', link.stockx_product_id)

    // Find variant with correct US size
    const correctVariant = allVariants?.find(v =>
      parseFloat(v.variant_value) === usSize
    )

    if (!correctVariant) {
      console.log(`   ❌ No variant found for US ${usSize}`)
      console.log(`   Available sizes: ${allVariants?.map(v => v.variant_value).join(', ')}`)
      totalFailed++
      continue
    }

    console.log(`   🔄 Remapping to: ${correctVariant.stockx_variant_id} (US ${correctVariant.variant_value})`)

    // Update the mapping
    const { error: updateError } = await supabase
      .from('inventory_market_links')
      .update({ stockx_variant_id: correctVariant.stockx_variant_id })
      .eq('item_id', item.id)
      .eq('stockx_product_id', link.stockx_product_id)

    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`)
      totalFailed++
    } else {
      console.log(`   ✅ Remapped successfully!`)
      totalRemapped++
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total items checked:   ${totalChecked}`)
  console.log(`Already correct:       ${totalCorrect}`)
  console.log(`Successfully remapped: ${totalRemapped}`)
  console.log(`Failed/Skipped:        ${totalFailed}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (totalRemapped > 0) {
    console.log('✅ Re-mapping complete! Run the market data sync to update prices.\n')
  }

} catch (error) {
  console.error('\n❌ Fatal error:', error.message)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
}
