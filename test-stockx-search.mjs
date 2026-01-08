#!/usr/bin/env node

/**
 * Quick test script to check StockX search for SKU DD1391-100
 */

import { createOrUpdateProductFromStockx } from './src/lib/catalog/stockx.ts'

const testSku = 'DD1391-100'

console.log('🧪 Testing StockX search for:', testSku)
console.log('=' .repeat(60))

try {
  const result = await createOrUpdateProductFromStockx({
    sku: testSku,
    currency: 'GBP',
  })

  console.log('\n📊 Result:', JSON.stringify(result, null, 2))

  if (result.success) {
    console.log('\n✅ SUCCESS: Product found on StockX')
  } else {
    console.log('\n❌ FAILED:', result.error)
  }
} catch (error) {
  console.error('\n💥 ERROR:', error.message)
  console.error(error)
}
