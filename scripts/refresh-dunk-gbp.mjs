/**
 * Refresh Nike Dunk Low Panda market data with GBP currency
 * Uses user OAuth token from database
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SKU = 'DD1391-100'
const SIZE = '10'  // US 10 = UK 9 (StockX uses US sizing)
const CURRENCY = 'GBP'

// StockX API configuration
const STOCKX_API_KEY = process.env.STOCKX_API_KEY
const STOCKX_BASE_URL = 'https://api.stockx.com'

if (!STOCKX_API_KEY) {
  console.error('❌ STOCKX_API_KEY not set')
  process.exit(1)
}

console.log('='.repeat(60))
console.log('Refreshing Nike Dunk Low Panda Market Data')
console.log('='.repeat(60))
console.log(`SKU: ${SKU}`)
console.log(`Size: US ${SIZE} (UK 9)`)
console.log(`Currency: ${CURRENCY}`)
console.log('')

// Step 1: Get user OAuth token from database
console.log('[1/5] Loading user OAuth token from database...')
const { data: accountData, error: accountError } = await supabase
  .from('stockx_accounts')
  .select('access_token, expires_at')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single()

if (accountError || !accountData) {
  console.error('❌ No StockX account found:', accountError)
  process.exit(1)
}

// Check if token is expired
const expiresAt = new Date(accountData.expires_at)
const now = new Date()
if (expiresAt <= now) {
  console.error('❌ User token is expired')
  process.exit(1)
}

const accessToken = accountData.access_token
console.log(`✓ User token loaded (expires in ${Math.round((expiresAt - now) / 1000 / 60)} minutes)\n`)

// Helper function to make authenticated StockX API calls
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
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// Step 2: Delete stale cache
console.log('[2/5] Deleting stale cache...')
const { error: deleteError, count } = await supabase
  .from('stockx_market_prices')
  .delete()
  .eq('sku', SKU)
  .eq('currency', CURRENCY)

if (deleteError) {
  console.error('❌ Error deleting cache:', deleteError)
  process.exit(1)
}
console.log(`✓ Deleted ${count || 0} stale records\n`)

// Step 3: Search for product with GBP currency
console.log('[3/5] Searching StockX for product with currencyCode=GBP...')

let searchUrl = `/v2/catalog/search?query=${encodeURIComponent(SKU)}&currencyCode=${CURRENCY}`
console.log(`API URL: ${STOCKX_BASE_URL}${searchUrl}\n`)

let searchResponse
try {
  searchResponse = await stockxRequest(searchUrl)
} catch (error) {
  console.error('❌ Search failed:', error.message)
  process.exit(1)
}

if (!searchResponse?.products || searchResponse.products.length === 0) {
  console.error('❌ No products found')
  process.exit(1)
}

const product = searchResponse.products[0]
if (!product) {
  console.error('❌ No product data in response')
  process.exit(1)
}

console.log('✓ Found product:')
console.log(`  Product ID: ${product.productId}`)
console.log(`  Title: ${product.title}`)
console.log(`  Brand: ${product.brand}`)
console.log('')

// Step 4: Get market data for all sizes
console.log('[4/5] Fetching market data for all sizes...')
const productId = product.productId

try {
  const marketUrl = `/v2/catalog/products/${productId}/market-data?currencyCode=${CURRENCY}`
  console.log(`API URL: ${STOCKX_BASE_URL}${marketUrl}\n`)

  const marketResponse = await stockxRequest(marketUrl)

  // marketResponse is an array of variants
  const variants = Array.isArray(marketResponse) ? marketResponse : []

  console.log('✓ Market data received:')
  console.log(`  Currency: ${CURRENCY}`)
  console.log(`  Variants: ${variants.length}`)
  console.log('')

  // The market-data endpoint doesn't return size information directly
  // We need to fetch the variants first to map variant IDs to sizes
  // For now, let's fetch all variants separately
  const variantsUrl = `/v2/catalog/products/${productId}/variants`
  console.log(`Fetching variants from: ${STOCKX_BASE_URL}${variantsUrl}\n`)

  const variantsResponse = await stockxRequest(variantsUrl)
  const variantsWithSizes = Array.isArray(variantsResponse) ? variantsResponse : []

  console.log(`  Found ${variantsWithSizes.length} variants with size info\n`)

  // Find US 10 (UK 9) variant
  const targetVariantInfo = variantsWithSizes.find(v => {
    const size = v.size || v.variantValue || ''
    return size === SIZE || size === '10' || size === 'US 10'
  })

  if (!targetVariantInfo) {
    console.log('⚠️  US 10 (UK 9) variant not found in variants list')
    console.log('Available variants:')
    variantsWithSizes.slice(0, 10).forEach(v => {
      console.log(`  Size: ${v.size || v.variantValue}, Variant ID: ${v.variantId}`)
    })
    process.exit(1)
  }

  // Find market data for this variant
  const targetVariant = variants.find(v => v.variantId === targetVariantInfo.variantId)

  if (targetVariant) {
    console.log('✓ Found US 10 (UK 9) market data:')
    console.log(`  Variant ID: ${targetVariant.variantId}`)
    console.log(`  Size: ${targetVariantInfo.size || targetVariantInfo.variantValue}`)
    console.log(`  Last Sale: £${targetVariant.lastSaleAmount || 'N/A'}`)
    console.log(`  Lowest Ask: £${targetVariant.lowestAskAmount || 'N/A'}`)
    console.log(`  Highest Bid: £${targetVariant.highestBidAmount || 'N/A'}`)
    console.log(`  Sales Last 72h: ${targetVariant.salesLast72Hours || 0}`)
    console.log('')

    // Step 5: Cache the new data
    console.log('[5/5] Caching new market data...')

    const cacheRecord = {
      sku: SKU,
      size: SIZE,
      currency: CURRENCY,
      last_sale: targetVariant.lastSaleAmount || null,
      lowest_ask: targetVariant.lowestAskAmount || null,
      highest_bid: targetVariant.highestBidAmount || null,
      sales_last_72h: targetVariant.salesLast72Hours || null,
      as_of: new Date().toISOString(),
      source: 'stockx'
    }

    const { error: insertError } = await supabase
      .from('stockx_market_prices')
      .insert(cacheRecord)

    if (insertError) {
      console.error('❌ Error caching data:', insertError)
    } else {
      console.log('✓ Market data cached successfully')
    }

    console.log('')
    console.log('='.repeat(60))
    console.log('Summary - Values from StockX GBP API:')
    console.log('='.repeat(60))
    console.log(`Last Sale: £${targetVariant?.lastSaleAmount || 'N/A'}`)
    console.log(`Lowest Ask: £${targetVariant?.lowestAskAmount || 'N/A'}`)
    console.log(`Highest Bid: £${targetVariant?.highestBidAmount || 'N/A'}`)
    console.log('='.repeat(60))
    console.log('')
    console.log('Expected values (from user):')
    console.log('  Last Sale: £65')
    console.log('  Lowest Ask: £60')
    console.log('  Highest Bid: £36')
    console.log('='.repeat(60))
  } else {
    console.log('⚠️  US 10 (UK 9) market data not found')
    console.log('Available market data (first 5):')
    variants.slice(0, 5).forEach(v => {
      const variantInfo = variantsWithSizes.find(vi => vi.variantId === v.variantId)
      const size = variantInfo ? (variantInfo.size || variantInfo.variantValue) : 'unknown'
      console.log(`  Size: ${size}, Last Sale: £${v.lastSaleAmount || 'N/A'}, Ask: £${v.lowestAskAmount || 'N/A'}, Bid: £${v.highestBidAmount || 'N/A'}`)
    })
  }

} catch (error) {
  console.error('❌ Error fetching market data:', error.message)
  process.exit(1)
}
