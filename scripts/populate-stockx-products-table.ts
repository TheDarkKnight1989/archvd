#!/usr/bin/env npx tsx
/**
 * Populate stockx_products table from new products table
 *
 * The old sync functions expect products in stockx_products table.
 * This bridges the gap between new products table and old stockx_products table.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔄 Populating stockx_products table from products table\n')

  // Get all products with StockX IDs from new products table
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      sku,
      brand,
      model,
      image_url,
      product_variants!inner (
        stockx_product_id
      )
    `)
    .not('product_variants.stockx_product_id', 'is', null)

  if (!products || products.length === 0) {
    console.log('No products with StockX IDs found')
    return
  }

  console.log(`Found ${products.length} products with StockX IDs\n`)

  let inserted = 0
  let updated = 0
  let errors = 0

  for (const product of products) {
    try {
      // Get the StockX product ID from variants
      const stockxProductId = product.product_variants[0].stockx_product_id

      if (!stockxProductId) continue

      // Upsert to stockx_products table (using correct schema)
      const { error } = await supabase
        .from('stockx_products')
        .upsert({
          stockx_product_id: stockxProductId,
          style_id: product.sku,
          title: product.model || product.sku,
          brand: product.brand,
          image_url: product.image_url,
          category: 'sneakers',
          gender: 'men',
        }, {
          onConflict: 'stockx_product_id'
        })

      if (error) {
        console.log(`  ❌ ${product.sku}: ${error.message}`)
        errors++
      } else {
        inserted++
        console.log(`  ✅ ${product.sku} → ${stockxProductId}`)
      }

    } catch (error: any) {
      console.log(`  ❌ ${product.sku}: ${error.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 POPULATION COMPLETE')
  console.log('='.repeat(80))
  console.log(`✅ Inserted/Updated: ${inserted}`)
  console.log(`❌ Errors: ${errors}`)

  // Verify final count
  const { count } = await supabase
    .from('stockx_products')
    .select('*', { count: 'exact', head: true })

  console.log(`📦 Total stockx_products: ${count}`)
  console.log('')
}

main().catch(console.error)
