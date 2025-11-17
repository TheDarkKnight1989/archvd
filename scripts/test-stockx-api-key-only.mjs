#!/usr/bin/env node
/**
 * Test StockX API with API Key Only (no OAuth)
 */

const TEST_SKU = 'DD1391-100'
const apiKey = process.env.STOCKX_API_KEY

console.log('Testing StockX API with API Key only...')
console.log('API Key:', apiKey ? 'Present' : 'Missing')
console.log()

// Try search with just API key
const searchUrl = `https://api.stockx.com/v2/search?query=${encodeURIComponent(TEST_SKU)}`

console.log('URL:', searchUrl)

const searchRes = await fetch(searchUrl, {
  headers: {
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

console.log('Status:', searchRes.status, searchRes.statusText)

if (!searchRes.ok) {
  const errorText = await searchRes.text()
  console.log('Error:', errorText)
} else {
  const data = await searchRes.json()
  console.log('Success! Products found:', data.products?.length || 0)
  if (data.products && data.products.length > 0) {
    console.log('First product:', data.products[0].name || data.products[0].title)
  }
}
