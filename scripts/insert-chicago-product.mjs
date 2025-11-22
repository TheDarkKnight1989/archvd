#!/usr/bin/env node
/**
 * Insert Chicago Low Product and Create Mappings
 *
 * This script:
 * 1. Fetches Chicago Low product data from StockX
 * 2. Inserts product into stockx_products table
 * 3. Inserts all variants into stockx_variants table
 * 4. Creates mappings for our two Chicago items (UK 9 and UK 11)
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Direct API calls to StockX
async function callStockxApi(endpoint) {
  const token = process.env.STOCKX_ACCESS_TOKEN
  const apiKey = process.env.STOCKX_API_KEY

  const response = await fetch(`https://api.stockx.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    }
  })

  if (!response.ok) {
    throw new Error(`StockX API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'
const CHICAGO_SKU = 'HQ6998-600'
const CHICAGO_PRODUCT_ID = '83c11c36-1e00-4831-85e5-6067abf2f18b'

// Our inventory items
const CHICAGO_ITEMS = [
  { id: '729d9d3d-b9e2-4f1e-8286-e235624b2923', size_uk: 9 },
  { id: '85a1fbbd-b271-4961-b65b-4d862ec2ac23', size_uk: 11 },
]

console.log('🧪 Inserting Chicago Low product and creating mappings...\n')

try {
  // Step 1: Fetch product data from StockX
  console.log('1️⃣  Fetching product data from StockX...')
  const searchData = await callStockxApi(
    `/v2/catalog/search?query=${encodeURIComponent(CHICAGO_SKU)}&pageSize=5&pageNumber=1`
  )

  const rawProduct = searchData.products?.find(p => p.styleId === CHICAGO_SKU)
  if (!rawProduct) {
    throw new Error(`Product not found for SKU ${CHICAGO_SKU}`)
  }

  // Normalize product data
  const product = {
    productId: rawProduct.productId,
    styleId: rawProduct.styleId,
    productName: rawProduct.title,
    brand: rawProduct.brand,
    colorway: rawProduct.productAttributes?.colorway || null,
    releaseDate: rawProduct.productAttributes?.releaseDate || null,
    retailPrice: rawProduct.productAttributes?.retailPrice || null,
    image: rawProduct.media?.imageUrl || null,
    category: rawProduct.productType || null,
    gender: rawProduct.productAttributes?.gender || null,
  }

  console.log(`   ✅ Found product: ${product.productName}`)
  console.log(`   Product ID: ${product.productId}\n`)

  // Step 2: Fetch variants
  console.log('2️⃣  Fetching variants...')
  const variantsData = await callStockxApi(
    `/v2/catalog/products/${product.productId}/variants`
  )

  // Normalize variants
  const variants = variantsData.map(v => ({
    variantId: v.variantId,
    variantValue: v.variantValue || v.size,
    variantType: v.variantType || 'size',
  }))

  console.log(`   ✅ Found ${variants.length} variants\n`)

  // Step 3: Insert product into database
  console.log('3️⃣  Inserting product into database...')
  const { error: productError } = await supabase
    .from('stockx_products')
    .upsert({
      stockx_product_id: product.productId,
      style_id: product.styleId,
      title: product.productName,
      brand: product.brand,
      colorway: product.colorway,
      release_date: product.releaseDate,
      retail_price: product.retailPrice,
      image_url: product.image,
      category: product.category,
      gender: product.gender,
    }, {
      onConflict: 'stockx_product_id'
    })

  if (productError) {
    console.error('   ❌ Error inserting product:', productError)
    throw productError
  }
  console.log('   ✅ Product inserted\n')

  // Get the product UUID (internal id) that was just inserted
  const { data: insertedProduct } = await supabase
    .from('stockx_products')
    .select('id')
    .eq('stockx_product_id', product.productId)
    .single()

  if (!insertedProduct) {
    throw new Error('Failed to retrieve inserted product')
  }

  // Step 4: Insert variants into database
  console.log('4️⃣  Inserting variants into database...')
  const variantInserts = variants.map(v => ({
    stockx_variant_id: v.variantId,
    stockx_product_id: product.productId,
    product_id: insertedProduct.id,
    variant_value: v.variantValue,
  }))

  const { error: variantsError } = await supabase
    .from('stockx_variants')
    .upsert(variantInserts, {
      onConflict: 'stockx_variant_id'
    })

  if (variantsError) {
    console.error('   ❌ Error inserting variants:', variantsError)
    throw variantsError
  }
  console.log(`   ✅ Inserted ${variantInserts.length} variants\n`)

  // Step 5: Create mappings for our Chicago items
  console.log('5️⃣  Creating mappings for Chicago items...\n')

  for (const item of CHICAGO_ITEMS) {
    console.log(`   Mapping item ${item.id} (UK ${item.size_uk})...`)

    // Find matching variant
    const matchingVariant = variants.find(v => {
      const sizeNum = parseFloat(v.variantValue)
      return Math.abs(sizeNum - item.size_uk) < 0.1
    })

    if (!matchingVariant) {
      console.log(`   ⚠️  No matching variant found for UK ${item.size_uk}`)
      continue
    }

    console.log(`   Found variant: ${matchingVariant.variantId} (${matchingVariant.variantValue})`)

    // Create mapping
    const { error: mappingError } = await supabase
      .from('inventory_market_links')
      .upsert({
        item_id: item.id,
        stockx_product_id: product.productId,
        stockx_variant_id: matchingVariant.variantId,
      }, {
        onConflict: 'item_id'
      })

    if (mappingError) {
      console.error(`   ❌ Error creating mapping:`, mappingError)
      throw mappingError
    }

    console.log(`   ✅ Mapping created for UK ${item.size_uk}\n`)
  }

  // Step 6: Verify mappings
  console.log('6️⃣  Verifying mappings...\n')

  for (const item of CHICAGO_ITEMS) {
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select(`
        *,
        stockx_product:stockx_products!inventory_market_links_stockx_product_id_fkey(stockx_product_id, title, style_id),
        stockx_variant:stockx_variants!inventory_market_links_stockx_variant_id_fkey(stockx_variant_id, variant_value)
      `)
      .eq('item_id', item.id)
      .single()

    if (mapping) {
      console.log(`   ✅ UK ${item.size_uk}: Mapped to ${mapping.stockx_product.style_id}`)
      console.log(`      Product: ${mapping.stockx_product.title}`)
      console.log(`      Variant: ${mapping.stockx_variant.variant_value}\n`)
    } else {
      console.log(`   ❌ UK ${item.size_uk}: Mapping not found\n`)
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ SUCCESS: Chicago Low product and mappings created!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
}
