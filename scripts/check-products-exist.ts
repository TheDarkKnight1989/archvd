#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkProducts() {
  const styleIds = ['HQ8487-500', 'IM7410-001']

  console.log('\n🔍 CHECKING PRODUCT EXISTENCE\n')

  for (const styleId of styleIds) {
    console.log(`\n${styleId}:`)

    // Check if product exists
    const { data: product } = await supabase
      .from('inventory_v4_products')
      .select('*')
      .eq('sku', styleId)
      .single()

    if (product) {
      console.log(`  ✅ EXISTS in inventory_v4_products`)
      console.log(`     Product ID: ${product.product_id}`)
      console.log(`     Name: ${product.name}`)
    } else {
      console.log(`  ❌ NOT FOUND in inventory_v4_products`)
      console.log(`     This means fullSyncStockxProductBySku should be called`)
    }

    // Check style catalog
    const { data: style } = await supabase
      .from('inventory_v4_style_catalog')
      .select('style_id, stockx_url_key')
      .eq('style_id', styleId)
      .single()

    if (style) {
      console.log(`  ✅ EXISTS in inventory_v4_style_catalog`)
      console.log(`     StockX URL Key: ${style.stockx_url_key}`)
    } else {
      console.log(`  ❌ NOT FOUND in inventory_v4_style_catalog`)
    }
  }

  console.log('\n')
}

checkProducts()
