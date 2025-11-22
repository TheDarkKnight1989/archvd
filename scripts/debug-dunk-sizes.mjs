/**
 * Debug Nike Dunk Low Panda - Show all available sizes and their market data
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SKU = 'DD1391-100'
const CURRENCY = 'GBP'

const STOCKX_API_KEY = process.env.STOCKX_API_KEY
const STOCKX_BASE_URL = 'https://api.stockx.com'

console.log('Fetching all sizes and market data for Nike Dunk Low Panda\n')

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

// Search for product
const searchUrl = `/v2/catalog/search?query=${encodeURIComponent(SKU)}&currencyCode=${CURRENCY}`
const searchResponse = await stockxRequest(searchUrl)
const product = searchResponse.products[0]
const productId = product.productId

console.log(`Product: ${product.title}`)
console.log(`Product ID: ${productId}\n`)

// Get variants with sizes
const variantsResponse = await stockxRequest(`/v2/catalog/products/${productId}/variants`)
const variantsWithSizes = Array.isArray(variantsResponse) ? variantsResponse : []

// Get market data
const marketResponse = await stockxRequest(`/v2/catalog/products/${productId}/market-data?currencyCode=${CURRENCY}`)
const marketData = Array.isArray(marketResponse) ? marketResponse : []

console.log('='.repeat(80))
console.log('ALL SIZES AND THEIR MARKET DATA (GBP):')
console.log('='.repeat(80))

// Show all variants with their market data
variantsWithSizes.forEach(variant => {
  const market = marketData.find(m => m.variantId === variant.variantId)
  const size = variant.size || variant.variantValue
  const lastSale = market?.lastSaleAmount || 'N/A'
  const lowestAsk = market?.lowestAskAmount || 'N/A'
  const highestBid = market?.highestBidAmount || 'N/A'

  console.log(`Size: ${size.toString().padEnd(6)} | Last Sale: £${String(lastSale).padEnd(6)} | Ask: £${String(lowestAsk).padEnd(6)} | Bid: £${String(highestBid).padEnd(6)} | Variant ID: ${variant.variantId}`)
})

console.log('='.repeat(80))
console.log('\nLooking for UK 9 (US 10)...')

// Find specific sizes
const size9 = variantsWithSizes.find(v => (v.size || v.variantValue) === '9')
const size10 = variantsWithSizes.find(v => (v.size || v.variantValue) === '10')
const sizeUK9 = variantsWithSizes.find(v => (v.size || v.variantValue) === 'UK 9')
const sizeUS10 = variantsWithSizes.find(v => (v.size || v.variantValue) === 'US 10')

if (size9) {
  const market = marketData.find(m => m.variantId === size9.variantId)
  console.log(`\nSize "9": Last Sale £${market?.lastSaleAmount || 'N/A'}, Ask £${market?.lowestAskAmount || 'N/A'}, Bid £${market?.highestBidAmount || 'N/A'}`)
}

if (size10) {
  const market = marketData.find(m => m.variantId === size10.variantId)
  console.log(`Size "10": Last Sale £${market?.lastSaleAmount || 'N/A'}, Ask £${market?.lowestAskAmount || 'N/A'}, Bid £${market?.highestBidAmount || 'N/A'}`)
}

if (sizeUK9) {
  const market = marketData.find(m => m.variantId === sizeUK9.variantId)
  console.log(`Size "UK 9": Last Sale £${market?.lastSaleAmount || 'N/A'}, Ask £${market?.lowestAskAmount || 'N/A'}, Bid £${market?.highestBidAmount || 'N/A'}`)
}

if (sizeUS10) {
  const market = marketData.find(m => m.variantId === sizeUS10.variantId)
  console.log(`Size "US 10": Last Sale £${market?.lastSaleAmount || 'N/A'}, Ask £${market?.lowestAskAmount || 'N/A'}, Bid £${market?.highestBidAmount || 'N/A'}`)
}

console.log('\n='.repeat(80))
console.log('Expected values from your screenshot (UK 9 / US 10):')
console.log('  Last Sale: £65, Lowest Ask: £60, Highest Bid: £36')
console.log('='.repeat(80))
