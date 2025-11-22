/**
 * Debug script to see RAW API response from StockX
 * This will show us exactly what fields the API returns
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SKU = 'DD1391-100'
const SIZE = '10'  // US 10 = UK 9
const CURRENCY = 'GBP'

const STOCKX_API_KEY = process.env.STOCKX_API_KEY
const STOCKX_BASE_URL = 'https://api.stockx.com'

console.log('='.repeat(80))
console.log('RAW API RESPONSE DEBUG')
console.log('='.repeat(80))

// Get user OAuth token
const { data: accountData } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single()

const accessToken = accountData.access_token

async function stockxRequest(endpoint) {
  const response = await fetch(`${STOCKX_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': STOCKX_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })
  if (!response.ok) throw new Error(`API error ${response.status}`)
  return response.json()
}

// 1. Search for product
console.log('\n[1/3] Searching for product...\n')
const searchUrl = `/v2/catalog/search?query=${encodeURIComponent(SKU)}&currencyCode=${CURRENCY}`
const searchResponse = await stockxRequest(searchUrl)

console.log('Search Response Structure:')
console.log('  - Has "products" array:', !!searchResponse.products)
console.log('  - Has "results" array:', !!searchResponse.results)
console.log('  - Number of products:', searchResponse.products?.length || 0)
console.log('')

const product = searchResponse.products[0]
const productId = product.productId || product.id

console.log('Product Fields:')
Object.keys(product).forEach(key => {
  console.log(`  - ${key}:`, typeof product[key])
})
console.log('')

// 2. Get variants
console.log('\n[2/3] Fetching variants...\n')
const variantsUrl = `/v2/catalog/products/${productId}/variants`
const variantsResponse = await stockxRequest(variantsUrl)
const variants = Array.isArray(variantsResponse) ? variantsResponse : []

const size10Variant = variants.find(v => {
  const size = v.size || v.variantValue || ''
  return size === '10' || size === SIZE
})

console.log('Variant Fields (US 10):')
if (size10Variant) {
  Object.keys(size10Variant).forEach(key => {
    console.log(`  - ${key}:`, size10Variant[key])
  })
} else {
  console.log('  ⚠️  US 10 variant not found!')
}
console.log('')

// 3. Get market data
console.log('\n[3/3] Fetching market data...\n')
const marketUrl = `/v2/catalog/products/${productId}/market-data?currencyCode=${CURRENCY}`
const marketResponse = await stockxRequest(marketUrl)

console.log('Market Data Response Type:', typeof marketResponse)
console.log('Market Data is Array:', Array.isArray(marketResponse))

if (Array.isArray(marketResponse)) {
  console.log('Market Data Array Length:', marketResponse.length)

  // Find US 10 market data
  const size10Market = marketResponse.find(v => v.variantId === size10Variant?.variantId)

  console.log('')
  console.log('='.repeat(80))
  console.log('RAW US 10 (UK 9) MARKET DATA:')
  console.log('='.repeat(80))
  console.log(JSON.stringify(size10Market, null, 2))
  console.log('='.repeat(80))

  console.log('')
  console.log('Field Check:')
  console.log('  - Has variantId:', !!size10Market?.variantId)
  console.log('  - Has lastSale:', !!size10Market?.lastSale)
  console.log('  - Has lastSaleAmount:', !!size10Market?.lastSaleAmount)
  console.log('  - Has lowestAsk:', !!size10Market?.lowestAsk)
  console.log('  - Has lowestAskAmount:', !!size10Market?.lowestAskAmount)
  console.log('  - Has highestBid:', !!size10Market?.highestBid)
  console.log('  - Has highestBidAmount:', !!size10Market?.highestBidAmount)

  console.log('')
  console.log('Actual Values:')
  console.log('  - lastSale:', size10Market?.lastSale)
  console.log('  - lastSaleAmount:', size10Market?.lastSaleAmount)
  console.log('  - lowestAsk:', size10Market?.lowestAsk)
  console.log('  - lowestAskAmount:', size10Market?.lowestAskAmount)
  console.log('  - highestBid:', size10Market?.highestBid)
  console.log('  - highestBidAmount:', size10Market?.highestBidAmount)

  console.log('')
  console.log('All Fields in Market Data Object:')
  if (size10Market) {
    Object.keys(size10Market).forEach(key => {
      console.log(`  - ${key}:`, size10Market[key])
    })
  }
} else {
  console.log('⚠️  Market data is NOT an array!')
  console.log('Response structure:', JSON.stringify(marketResponse, null, 2))
}

console.log('')
console.log('='.repeat(80))
console.log('Expected from user:')
console.log('  Last Sale: £65')
console.log('  Lowest Ask: £60')
console.log('  Highest Bid: £36')
console.log('='.repeat(80))
