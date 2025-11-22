#!/usr/bin/env node
/**
 * Test Chicago Low StockX Search (Direct API)
 * Tests if HQ6998-600 search returns correct results with fixed code
 */

import dotenv from 'dotenv'
import { StockxCatalogService } from '../src/lib/services/stockx/catalog.js'

dotenv.config({ path: '.env.local' })

const SKU = 'HQ6998-600'

console.log('🧪 Testing StockX search for Chicago Low...\n')
console.log(`SKU: ${SKU}\n`)

try {
  // Create catalog service instance
  const catalog = new StockxCatalogService()

  // Search for the product
  console.log('Searching StockX...')
  const results = await catalog.searchProducts(SKU, { limit: 10 })

  console.log(`\n✅ Found ${results.length} result(s):\n`)

  results.forEach((product, index) => {
    console.log(`${index + 1}. ${product.productName}`)
    console.log(`   Product ID: ${product.productId}`)
    console.log(`   Style ID: ${product.styleId}`)
    console.log(`   Brand: ${product.brand}`)
    console.log(`   SKU Match: ${product.styleId === SKU ? '✅ EXACT MATCH' : '❌ No match'}`)
    console.log('')
  })

  // Check for exact SKU match
  const exactMatch = results.find(p => p.styleId === SKU)

  if (exactMatch) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ SUCCESS: Found exact SKU match!')
    console.log(`   Product ID: ${exactMatch.productId}`)
    console.log(`   Title: ${exactMatch.productName}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Now get variants for this product
    console.log('Fetching variants for exact match...')
    const variants = await catalog.getProductVariants(exactMatch.productId)

    console.log(`\nFound ${variants.length} variants:`)
    const sizeVariants = variants.filter(v => v.variantValue === '9' || v.variantValue === '11')
    if (sizeVariants.length > 0) {
      console.log('\nRelevant sizes (UK 9/11):')
      sizeVariants.forEach(v => {
        console.log(`  - Size ${v.variantValue}: ${v.variantId}`)
      })
    }

  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('❌ PROBLEM: No exact SKU match found!')
    console.log(`   The fixed code would REJECT this mapping (correct behavior)`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }

} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) {
    console.error('\nStack trace:')
    console.error(error.stack)
  }
  process.exit(1)
}
