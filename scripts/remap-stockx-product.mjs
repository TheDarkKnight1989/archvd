#!/usr/bin/env node
/**
 * PHASE 3.10: StockX Product Remapping Utility
 *
 * Purpose: Fix broken StockX product mappings when product IDs become invalid (404)
 *
 * Usage:
 *   node scripts/remap-stockx-product.mjs HQ6998-600
 *
 * What it does:
 *   1. Searches StockX for the given SKU/style ID
 *   2. Shows candidate products with their details
 *   3. Lets you select the correct product
 *   4. Updates inventory_market_links to use the new product/variant IDs
 *
 * WHY: When StockX changes their product IDs or deprecates old ones, we get 404s.
 *      This script lets you find the new correct product and update the mapping.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const sku = process.argv[2]

if (!sku) {
  console.log('Usage: node scripts/remap-stockx-product.mjs <SKU>')
  console.log('Example: node scripts/remap-stockx-product.mjs HQ6998-600')
  process.exit(1)
}

console.log(`\n🔍 PHASE 3.10: Remap StockX Product for SKU: ${sku}\n`)

// Step 1: Find all inventory items with this SKU
console.log('STEP 1: Finding inventory items with this SKU...')
const { data: inventoryItems, error: invError } = await supabase
  .from('Inventory')
  .select('id, sku, size, brand, model, colorway')
  .eq('sku', sku)

if (invError) {
  console.error('❌ Error querying inventory:', invError.message)
  process.exit(1)
}

if (!inventoryItems || inventoryItems.length === 0) {
  console.log(`❌ No inventory items found with SKU: ${sku}`)
  process.exit(1)
}

console.log(`✅ Found ${inventoryItems.length} inventory item(s):`)
inventoryItems.forEach((item, idx) => {
  console.log(`   ${idx + 1}. ID: ${item.id}`)
  console.log(`      Size: ${item.size || 'N/A'}`)
  console.log(`      Brand: ${item.brand || 'N/A'}, Model: ${item.model || 'N/A'}`)
  console.log(`      Colorway: ${item.colorway || 'N/A'}`)
})

// Step 2: Check current mappings
console.log('\nSTEP 2: Checking current StockX mappings...')
const { data: currentMappings, error: mapError } = await supabase
  .from('inventory_market_links')
  .select('*')
  .in('item_id', inventoryItems.map(i => i.id))

if (mapError) {
  console.error('❌ Error querying mappings:', mapError.message)
  process.exit(1)
}

if (!currentMappings || currentMappings.length === 0) {
  console.log('⚠️  No existing mappings found')
} else {
  console.log(`✅ Found ${currentMappings.length} existing mapping(s):`)
  currentMappings.forEach((mapping) => {
    console.log(`   Item ID: ${mapping.item_id}`)
    console.log(`   Product ID: ${mapping.stockx_product_id}`)
    console.log(`   Variant ID: ${mapping.stockx_variant_id}`)
    console.log()
  })
}

// Step 3: Search StockX for candidates
console.log('STEP 3: Searching StockX for matching products...')
console.log(`   Calling: https://api.stockx.com/v2/search?query=${sku}`)

try {
  const searchResponse = await fetch(
    `https://api.stockx.com/v2/search?query=${encodeURIComponent(sku)}`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'archvd/1.0',
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
    }
  )

  if (!searchResponse.ok) {
    console.error(`❌ StockX search API returned ${searchResponse.status}`)
    const errorText = await searchResponse.text()
    console.error('   Error:', errorText.substring(0, 300))
    process.exit(1)
  }

  const searchData = await searchResponse.json()

  // Extract products from search results
  const products = searchData?.hits || []

  if (products.length === 0) {
    console.log(`❌ No products found on StockX for SKU: ${sku}`)
    console.log('   Try searching on stockx.com manually to verify the SKU exists')
    process.exit(1)
  }

  console.log(`\n✅ Found ${products.length} candidate product(s) on StockX:\n`)

  products.forEach((product, idx) => {
    console.log(`${idx + 1}. ${product.name || product.title || 'Unknown Product'}`)
    console.log(`   Product ID: ${product.objectID || product.id || 'N/A'}`)
    console.log(`   Brand: ${product.brand || 'N/A'}`)
    console.log(`   Colorway: ${product.colorway || 'N/A'}`)
    console.log(`   Style ID: ${product.styleId || 'N/A'}`)
    console.log(`   Category: ${product.productCategory || 'N/A'}`)
    console.log(`   Retail Price: ${product.retailPrice ? '$' + product.retailPrice : 'N/A'}`)
    console.log(`   Release Date: ${product.releaseDate || 'N/A'}`)
    console.log()
  })

  // Step 4: Let user select the correct product
  const rl = readline.createInterface({ input, output })

  const answer = await rl.question(`Enter the number of the correct product (1-${products.length}), or 0 to cancel: `)
  rl.close()

  const choice = parseInt(answer, 10)

  if (choice === 0 || isNaN(choice)) {
    console.log('\n❌ Cancelled by user')
    process.exit(0)
  }

  if (choice < 1 || choice > products.length) {
    console.log(`\n❌ Invalid choice: ${answer}`)
    process.exit(1)
  }

  const selectedProduct = products[choice - 1]
  const newProductId = selectedProduct.objectID || selectedProduct.id

  if (!newProductId) {
    console.log('\n❌ Selected product has no product ID')
    process.exit(1)
  }

  console.log(`\n✅ Selected: ${selectedProduct.name || selectedProduct.title}`)
  console.log(`   Product ID: ${newProductId}`)

  // Step 5: Fetch variants for this product to get variant IDs
  console.log('\nSTEP 5: Fetching variants for this product...')

  const marketResponse = await fetch(
    `https://api.stockx.com/v2/catalog/products/${newProductId}/market`,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'archvd/1.0',
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
    }
  )

  if (!marketResponse.ok) {
    console.error(`❌ StockX market API returned ${marketResponse.status}`)
    const errorText = await marketResponse.text()
    console.error('   Error:', errorText.substring(0, 300))
    process.exit(1)
  }

  const marketData = await marketResponse.json()
  const variants = marketData?.market?.productMarket || []

  if (variants.length === 0) {
    console.log('❌ No variants found for this product')
    process.exit(1)
  }

  console.log(`✅ Found ${variants.length} variant(s):\n`)

  // Create a map of size -> variant ID
  const sizeToVariantMap = new Map()

  variants.forEach((variant, idx) => {
    const size = variant.variantValue // e.g., "UK 9", "US 10", "9", etc.
    console.log(`   ${idx + 1}. Size: ${size} (Variant ID: ${variant.variantId})`)

    // Normalize size for matching (strip "UK" prefix if present)
    const normalizedSize = size?.replace(/^UK\s*/i, '').trim()
    if (normalizedSize) {
      sizeToVariantMap.set(normalizedSize, variant.variantId)
    }
  })

  console.log()

  // Step 6: Update mappings for each inventory item
  console.log('STEP 6: Updating inventory_market_links...\n')

  let updatedCount = 0
  let errorCount = 0

  for (const item of inventoryItems) {
    // Normalize inventory item size (strip "UK" prefix if present)
    const normalizedItemSize = item.size?.replace(/^UK\s*/i, '').trim()

    if (!normalizedItemSize) {
      console.log(`⚠️  Item ${item.id}: No size specified, skipping`)
      continue
    }

    // Find matching variant
    const variantId = sizeToVariantMap.get(normalizedItemSize)

    if (!variantId) {
      console.log(`❌ Item ${item.id} (Size: ${item.size}): No matching variant found`)
      console.log(`   Available sizes: ${Array.from(sizeToVariantMap.keys()).join(', ')}`)
      errorCount++
      continue
    }

    // Upsert the mapping
    const { error: upsertError } = await supabase
      .from('inventory_market_links')
      .upsert({
        item_id: item.id,
        stockx_product_id: newProductId,
        stockx_variant_id: variantId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'item_id',
      })

    if (upsertError) {
      console.log(`❌ Item ${item.id}: Failed to update mapping`)
      console.log(`   Error: ${upsertError.message}`)
      errorCount++
    } else {
      console.log(`✅ Item ${item.id} (Size: ${item.size}):`)
      console.log(`   Product ID: ${newProductId}`)
      console.log(`   Variant ID: ${variantId}`)
      updatedCount++
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('SUMMARY:')
  console.log(`  Updated: ${updatedCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log('='.repeat(80))

  if (updatedCount > 0) {
    console.log(`\n✅ Successfully remapped ${updatedCount} item(s) to new StockX product`)
    console.log('\nNEXT STEPS:')
    console.log('  1. Trigger a sync to fetch fresh market data:')
    console.log('     curl -X POST http://localhost:3000/api/stockx/sync/prices')
    console.log('')
    console.log('  2. Check the Portfolio page to verify prices are now different for each size')
    console.log('  3. Compare with StockX website to ensure prices match')
  }

} catch (apiError) {
  console.error('\n❌ Failed to call StockX API:', apiError.message)
  process.exit(1)
}
