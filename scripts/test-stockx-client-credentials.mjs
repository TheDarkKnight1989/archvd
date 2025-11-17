#!/usr/bin/env node
/**
 * Test StockX Client Credentials Authentication
 * This tests that the StockX client can authenticate WITHOUT OAuth user flow
 */

import { getStockxClient } from '../src/lib/services/stockx/client.ts'

async function testClientCredentials() {
  console.log('🧪 Testing StockX Client Credentials Authentication...')
  console.log()

  try {
    // Create client WITHOUT userId (uses app-level client credentials)
    console.log('1️⃣  Creating StockX client (app-level, no OAuth)...')
    const client = getStockxClient()
    console.log('   ✅ Client created')
    console.log()

    // Test with a simple search request
    console.log('2️⃣  Testing API call: Search for "DZ5485-410"...')
    const searchResult = await client.request('/v2/catalog/search?query=DZ5485-410')
    console.log('   ✅ API call successful!')
    console.log()

    // Show results
    if (searchResult.products && searchResult.products.length > 0) {
      const product = searchResult.products[0]
      console.log('📦 Product Found:')
      console.log(`   Title: ${product.title || product.name}`)
      console.log(`   Brand: ${product.brand}`)
      console.log(`   Product ID: ${product.productId || product.id}`)
      console.log()
    }

    console.log('✅ SUCCESS: StockX client credentials authentication is working!')
    console.log()
    console.log('This means all StockX APIs can now be used WITHOUT OAuth user flow.')
    console.log()

  } catch (error) {
    console.error('❌ FAILED:', error.message)
    console.error()
    console.error('Full error:', error)
    console.error()
    process.exit(1)
  }
}

testClientCredentials()
