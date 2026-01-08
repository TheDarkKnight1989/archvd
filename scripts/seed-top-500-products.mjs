#!/usr/bin/env node
/**
 * Seed Top 500 Products into existing products table
 *
 * This populates the empty products table with popular sneakers
 * Maps them to StockX and Alias IDs
 * Creates size variants for each product
 */

import { createClient } from '@supabase/supabase-js'
import { createAliasClient } from '../src/lib/services/alias/client.mjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ═══════════════════════════════════════════════════════════════════════════════
// TOP 500 PRODUCTS LIST
// ═══════════════════════════════════════════════════════════════════════════════

const TOP_500_PRODUCTS = [
  // Jordan Brand (Top 100)
  { sku: 'DZ5485-612', brand: 'Jordan', model: 'Air Jordan 4', colorway: 'Military Black', category: 'sneakers', retail: 210, tier: 'hot' },
  { sku: 'DD1391-100', brand: 'Jordan', model: 'Air Jordan 1 High', colorway: 'Chicago', category: 'sneakers', retail: 170, tier: 'hot' },
  { sku: 'FD0785-100', brand: 'Jordan', model: 'Air Jordan 4', colorway: 'SB Pine Green', category: 'sneakers', retail: 225, tier: 'hot' },
  { sku: 'DV0788-161', brand: 'Jordan', model: 'Air Jordan 1 High', colorway: 'UNC Toe', category: 'sneakers', retail: 180, tier: 'hot' },
  { sku: 'FV5029-010', brand: 'Jordan', model: 'Air Jordan 4', colorway: 'Infrared', category: 'sneakers', retail: 215, tier: 'hot' },
  { sku: 'IF4491-100', brand: 'Jordan', model: 'Air Jordan 1 Low', colorway: 'Midnight Navy', category: 'sneakers', retail: 140, tier: 'warm' },
  { sku: 'DZ5485-410', brand: 'Jordan', model: 'Air Jordan 4', colorway: 'Frozen Moments', category: 'sneakers', retail: 225, tier: 'hot' },
  { sku: 'DC7723-100', brand: 'Jordan', model: 'Air Jordan 1 High', colorway: 'Bordeaux', category: 'sneakers', retail: 170, tier: 'warm' },
  { sku: 'DM9652-101', brand: 'Jordan', model: 'Air Jordan 1 Mid', colorway: 'White Shadow', category: 'sneakers', retail: 125, tier: 'warm' },
  { sku: 'CT8532-175', brand: 'Jordan', model: 'Air Jordan 1 Low', colorway: 'Neutral Grey', category: 'sneakers', retail: 110, tier: 'warm' },

  // Nike Dunk (Top 50)
  { sku: 'DD1391-100', brand: 'Nike', model: 'Dunk Low', colorway: 'Panda', category: 'sneakers', retail: 110, tier: 'hot' },
  { sku: 'CW1590-100', brand: 'Nike', model: 'Dunk Low', colorway: 'Kentucky', category: 'sneakers', retail: 110, tier: 'warm' },
  { sku: 'DD1503-101', brand: 'Nike', model: 'Dunk Low', colorway: 'Georgetown', category: 'sneakers', retail: 110, tier: 'warm' },
  { sku: 'DV0833-103', brand: 'Nike', model: 'Dunk Low', colorway: 'UNC', category: 'sneakers', retail: 110, tier: 'warm' },
  { sku: 'DR9705-100', brand: 'Nike', model: 'Dunk Low', colorway: 'Black White', category: 'sneakers', retail: 110, tier: 'hot' },

  // Yeezy (Top 30)
  { sku: 'GZ5541', brand: 'adidas', model: 'Yeezy Boost 350 V2', colorway: 'Onyx', category: 'sneakers', retail: 230, tier: 'hot' },
  { sku: 'GW3773', brand: 'adidas', model: 'Yeezy Slide', colorway: 'Bone', category: 'sneakers', retail: 70, tier: 'hot' },
  { sku: 'GY7657', brand: 'adidas', model: 'Yeezy Boost 350 V2', colorway: 'Beluga Reflective', category: 'sneakers', retail: 240, tier: 'warm' },
  { sku: 'GZ0541', brand: 'adidas', model: 'Yeezy Slide', colorway: 'Pure', category: 'sneakers', retail: 70, tier: 'warm' },
  { sku: 'HP8739', brand: 'adidas', model: 'Yeezy Foam Runner', colorway: 'MX Carbon', category: 'sneakers', retail: 90, tier: 'warm' },

  // New Balance (Top 50)
  { sku: 'M990GL6', brand: 'New Balance', model: '990v6', colorway: 'Grey', category: 'sneakers', retail: 185, tier: 'hot' },
  { sku: 'M2002RDA', brand: 'New Balance', model: '2002R', colorway: 'Protection Pack', category: 'sneakers', retail: 150, tier: 'hot' },
  { sku: 'U9060LIN', brand: 'New Balance', model: '9060', colorway: 'Lunar New Year', category: 'sneakers', retail: 150, tier: 'warm' },
  { sku: 'BB550PWB', brand: 'New Balance', model: '550', colorway: 'White Green', category: 'sneakers', retail: 110, tier: 'warm' },
  { sku: 'ML574EVG', brand: 'New Balance', model: '574', colorway: 'Grey', category: 'sneakers', retail: 90, tier: 'cold' },

  // Nike Air Max (Top 30)
  { sku: 'DH4245-101', brand: 'Nike', model: 'Air Max 1', colorway: 'Travis Scott Cactus Jack', category: 'sneakers', retail: 150, tier: 'hot' },
  { sku: 'FD9082-100', brand: 'Nike', model: 'Air Max 1', colorway: 'Corduroy', category: 'sneakers', retail: 140, tier: 'warm' },
  { sku: 'CZ8589-100', brand: 'Nike', model: 'Air Max 90', colorway: 'Bacon', category: 'sneakers', retail: 140, tier: 'warm' },
  { sku: 'DN4928-100', brand: 'Nike', model: 'Air Max Plus', colorway: 'Utility', category: 'sneakers', retail: 160, tier: 'cold' },

  // Asics (Top 20)
  { sku: '1201A789-020', brand: 'Asics', model: 'Gel-Kayano 14', colorway: 'Cream', category: 'sneakers', retail: 150, tier: 'warm' },
  { sku: '1203A413-100', brand: 'Asics', model: 'Gel-1130', colorway: 'White Silver', category: 'sneakers', retail: 100, tier: 'warm' },

  // Salomon (Top 20)
  { sku: 'L47452400', brand: 'Salomon', model: 'XT-6', colorway: 'Black Phantom', category: 'sneakers', retail: 190, tier: 'warm' },
  { sku: 'L47580900', brand: 'Salomon', model: 'ACS Pro', colorway: 'Ebony', category: 'sneakers', retail: 170, tier: 'cold' },

  // On Running (Top 20)
  { sku: '3MD10251375', brand: 'On', model: 'Cloudmonster', colorway: 'All White', category: 'sneakers', retail: 170, tier: 'warm' },
  { sku: '61.98729', brand: 'On', model: 'Cloud 5', colorway: 'All Black', category: 'sneakers', retail: 140, tier: 'cold' },

  // Vans (Top 20)
  { sku: 'VN0A3WKT6BT', brand: 'Vans', model: 'Old Skool', colorway: 'Black White', category: 'sneakers', retail: 70, tier: 'cold' },

  // Converse (Top 10)
  { sku: '170154C', brand: 'Converse', model: 'Chuck 70', colorway: 'Black', category: 'sneakers', retail: 85, tier: 'cold' },

  // TODO: Add remaining 400+ products
  // This is a starter list - will expand based on your feedback
]

console.log(`📦 Preparing to seed ${TOP_500_PRODUCTS.length} products...\n`)

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Find Alias Catalog ID
// ═══════════════════════════════════════════════════════════════════════════════

async function findAliasCatalogId(sku) {
  // First check if already in our alias_catalog_items table
  const { data: existing } = await supabase
    .from('alias_catalog_items')
    .select('catalog_id, image_url')
    .eq('sku', sku.toUpperCase().replace(/[-\s]/g, ' ').trim())
    .maybeSingle()

  if (existing) {
    return {
      catalogId: existing.catalog_id,
      imageUrl: existing.image_url
    }
  }

  // TODO: Search Alias API if not in database
  // For now, return null
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Find StockX Product ID
// ═══════════════════════════════════════════════════════════════════════════════

async function findStockXProductId(sku) {
  const { data: existing } = await supabase
    .from('stockx_products')
    .select('stockx_product_id, image_url')
    .eq('style_id', sku.toUpperCase().replace(/[-\s]/g, ' ').trim())
    .maybeSingle()

  if (existing) {
    return {
      productId: existing.stockx_product_id,
      imageUrl: existing.image_url
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEEDING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function seedProducts() {
  console.log('🌱 Starting product seeding...\n')

  let seeded = 0
  let skipped = 0
  let errors = 0

  for (const product of TOP_500_PRODUCTS) {
    try {
      console.log(`Processing: ${product.brand} ${product.model} ${product.colorway || ''} (${product.sku})`)

      // Check if already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', product.sku)
        .maybeSingle()

      if (existing) {
        console.log(`  ⏭️  Already exists, skipping`)
        skipped++
        continue
      }

      // Find provider IDs
      const aliasData = await findAliasCatalogId(product.sku)
      const stockxData = await findStockXProductId(product.sku)

      const imageUrl = aliasData?.imageUrl || stockxData?.imageUrl || null

      // Insert product
      const { data: insertedProduct, error: productError } = await supabase
        .from('products')
        .insert({
          sku: product.sku,
          brand: product.brand,
          model: product.model,
          colorway: product.colorway || null,
          category: product.category,
          retail_price: product.retail,
          retail_currency: 'USD',
          tier: product.tier,
          popularity_score: product.tier === 'hot' ? 100 : product.tier === 'warm' ? 50 : 25,
          image_url: imageUrl
        })
        .select()
        .single()

      if (productError) {
        console.log(`  ❌ Error inserting product: ${productError.message}`)
        errors++
        continue
      }

      console.log(`  ✅ Product created: ${insertedProduct.id}`)

      // Create size variants (standard US sizes 3.5-18)
      const sizes = []
      for (let size = 3.5; size <= 18; size += 0.5) {
        sizes.push({
          product_id: insertedProduct.id,
          size_key: size.toString(),
          size_numeric: size,
          size_system: 'US',
          alias_catalog_id: aliasData?.catalogId || null,
          stockx_product_id: stockxData?.productId || null
        })
      }

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(sizes)

      if (variantsError) {
        console.log(`  ⚠️  Error creating variants: ${variantsError.message}`)
      } else {
        console.log(`  ✅ Created ${sizes.length} size variants`)
      }

      seeded++

      // Rate limit: 1 product per second
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SEEDING COMPLETE')
  console.log('='.repeat(80))
  console.log(`✅ Seeded: ${seeded}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📦 Total: ${TOP_500_PRODUCTS.length}`)
  console.log('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════════

seedProducts().catch(console.error)
