#!/usr/bin/env node
/**
 * Test StockX API Raw Response
 * Directly call StockX market-data endpoint to see what we're getting
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const PRODUCT_ID = '83c11c36-1e00-4831-85e5-6067abf2f18b' // Chicago Low
const CURRENCY = 'GBP'

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
    const errorText = await response.text()
    throw new Error(`StockX API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

console.log('🧪 Testing StockX Market Data API\n')
console.log(`Product ID: ${PRODUCT_ID}`)
console.log(`Currency: ${CURRENCY}\n`)

try {
  const endpoint = `/v2/catalog/products/${PRODUCT_ID}/market-data?currencyCode=${CURRENCY}`
  console.log(`Calling: ${endpoint}\n`)

  const data = await callStockxApi(endpoint)

  console.log('✅ API Response:')
  console.log(`Total variants: ${data.length}\n`)

  if (data.length > 0) {
    console.log('First 3 variants:')
    data.slice(0, 3).forEach((variant, idx) => {
      console.log(`\n[${idx}] Variant:`)
      console.log(JSON.stringify(variant, null, 2))
    })

    // Check if ANY variant has market data
    const withMarketData = data.filter(v =>
      v.lowestAsk !== null ||
      v.highestBid !== null ||
      v.lastSale !== null
    )

    console.log(`\n\nVariants with market data: ${withMarketData.length}/${data.length}`)

    if (withMarketData.length > 0) {
      console.log('\nExample variant WITH market data:')
      console.log(JSON.stringify(withMarketData[0], null, 2))
    }
  } else {
    console.log('⚠️  Empty array returned')
  }

} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) {
    console.error('\nStack:', error.stack)
  }
  process.exit(1)
}
