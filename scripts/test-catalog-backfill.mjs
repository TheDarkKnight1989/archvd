#!/usr/bin/env node
/**
 * Test StockX Catalog Backfill
 * Calls the backfill API and shows results
 */

console.log('\n🧪 Testing StockX Catalog Backfill API...\n')

const response = await fetch('http://localhost:3000/api/stockx/backfill/catalog', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})

const data = await response.json()

console.log('Status:', response.status)
console.log('Response:', JSON.stringify(data, null, 2))

if (!response.ok) {
  console.error('\n❌ Backfill failed')
  process.exit(1)
}

console.log('\n✅ Backfill completed successfully!')
console.log(`   • Links: ${data.links}`)
console.log(`   • Distinct Products: ${data.distinctProducts}`)
console.log(`   • Products Before: ${data.productsBefore}`)
console.log(`   • Products After: ${data.productsAfter}`)
console.log(`   • Hydrated: ${data.hydratedProducts}`)
console.log(`   • Errors: ${data.errors}`)
console.log(`   • Duration: ${data.duration_ms}ms\n`)
