/**
 * Check if the variant-specific market-data endpoint has lastSale
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SKU = 'DD1391-100'
const CURRENCY = 'GBP'

const STOCKX_API_KEY = process.env.STOCKX_API_KEY
const STOCKX_BASE_URL = 'https://api.stockx.com'

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
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error ${response.status}: ${text}`)
  }
  return response.json()
}

console.log('Testing variant-specific market-data endpoint...\n')

// Get product and variant
const searchUrl = `/v2/catalog/search?query=${encodeURIComponent(SKU)}&currencyCode=${CURRENCY}`
const searchResponse = await stockxRequest(searchUrl)
const product = searchResponse.products[0]
const productId = product.productId

const variantsUrl = `/v2/catalog/products/${productId}/variants`
const variants = await stockxRequest(variantsUrl)
const size10Variant = variants.find(v => (v.variantValue || v.size) === '10')
const variantId = size10Variant.variantId

console.log(`Product ID: ${productId}`)
console.log(`Variant ID: ${variantId}`)
console.log('')

// Try variant-specific endpoint
try {
  console.log('Trying: /v2/catalog/products/{productId}/variants/{variantId}/market-data\n')
  const variantMarketUrl = `/v2/catalog/products/${productId}/variants/${variantId}/market-data?currencyCode=${CURRENCY}`
  const variantMarketData = await stockxRequest(variantMarketUrl)

  console.log('RAW RESPONSE:')
  console.log(JSON.stringify(variantMarketData, null, 2))
  console.log('')

  console.log('Has lastSale:', !!variantMarketData.lastSale)
  console.log('Has lastSaleAmount:', !!variantMarketData.lastSaleAmount)
  console.log('Has lastSalePrice:', !!variantMarketData.lastSalePrice)
} catch (error) {
  console.error('Error:', error.message)
}
