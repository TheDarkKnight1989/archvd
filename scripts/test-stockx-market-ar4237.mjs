#!/usr/bin/env node

/**
 * Test StockX Market Data API for AR4237-005
 * Uses user OAuth token from database
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const STOCKX_API_KEY = process.env.STOCKX_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!STOCKX_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Get user's OAuth token
async function getUserToken() {
  const { data, error } = await supabase
    .from('stockx_accounts')
    .select('access_token, refresh_token, expires_at')
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('No StockX account found in database')
  }

  // Check if token expired
  const expiresAt = new Date(data.expires_at)
  const now = new Date()

  if (expiresAt <= now) {
    console.log('⚠️  Token expired, needs refresh')
  }

  return data.access_token
}

// Search for product by SKU
async function searchProduct(token, sku) {
  const url = `https://api.stockx.com/v2/catalog/search?query=${sku}&pageNumber=1&pageSize=5&currencyCode=GBP`

  console.log('🔍 Searching for SKU:', sku)
  console.log('URL:', url)

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': STOCKX_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Search failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data
}

// Get market data for product
async function getMarketData(token, productId, currencyCode = 'GBP') {
  const url = `https://api.stockx.com/v2/catalog/products/${productId}/market-data?currencyCode=${currencyCode}`

  console.log('\n📊 Fetching market data')
  console.log('Product ID:', productId)
  console.log('Currency:', currencyCode)
  console.log('URL:', url)

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': STOCKX_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  console.log('Response status:', response.status)
  console.log('Response headers:', Object.fromEntries(response.headers.entries()))

  if (!response.ok) {
    const error = await response.text()
    console.error('Error response:', error)
    throw new Error(`Market data failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data
}

// Main
async function main() {
  try {
    console.log('🚀 Testing StockX Market Data API for AR4237-005\n')

    // Step 1: Get user token
    console.log('🔐 Getting user OAuth token from database...')
    const token = await getUserToken()
    console.log('✅ Token obtained:', token.substring(0, 20) + '...')

    // Step 2: Search for product
    const searchResults = await searchProduct(token, 'AR4237-005')
    console.log('\n📦 Search results:')
    console.log(JSON.stringify(searchResults, null, 2))

    if (!searchResults.products || searchResults.products.length === 0) {
      console.error('\n❌ No products found for SKU: AR4237-005')
      process.exit(1)
    }

    const product = searchResults.products[0]
    const productId = product.productId // Note: API returns 'productId' not 'id'

    console.log('\n✅ Found product:', product.title)
    console.log('Product ID:', productId)

    // Step 3: Get market data
    const marketData = await getMarketData(token, productId, 'GBP')
    console.log('\n💰 Market Data (all sizes):')
    console.log(JSON.stringify(marketData, null, 2))

    // Summary
    console.log('\n📈 Summary:')
    console.log('Total variants:', Array.isArray(marketData) ? marketData.length : 0)

    if (Array.isArray(marketData) && marketData.length > 0) {
      console.log('\nAll variants:')
      marketData.forEach((variant, i) => {
        console.log(`  ${i + 1}. Size ${variant.variantValue || variant.size}: Ask £${variant.lowestAskAmount || 'N/A'}, Bid £${variant.highestBidAmount || 'N/A'}`)
      })
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

main()
