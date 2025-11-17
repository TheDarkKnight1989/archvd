#!/usr/bin/env node
/**
 * Debug StockX API Calls
 * WHY: See actual error responses from StockX API
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_SKU = 'DD1391-100' // Nike Dunk Low Panda
const TEST_SIZE = '9'

async function debugStockX() {
  console.log('🔍 Debugging StockX API for:', TEST_SKU, 'Size:', TEST_SIZE)
  console.log()

  // 1. Get OAuth token
  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
  const { data: account } = await supabase
    .from('stockx_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!account) {
    console.log('❌ No StockX account found')
    return
  }

  const accessToken = account.access_token
  const apiKey = process.env.STOCKX_API_KEY

  console.log('✅ OAuth Token:', accessToken ? 'Present' : 'Missing')
  console.log('✅ API Key:', apiKey ? 'Present' : 'Missing')
  console.log()

  // 2. Search for product
  console.log('Step 1: Searching for product...')
  const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(TEST_SKU)}`

  console.log('  URL:', searchUrl)

  const searchRes = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  console.log('  Status:', searchRes.status, searchRes.statusText)

  if (!searchRes.ok) {
    const errorText = await searchRes.text()
    console.log('  ❌ Error Response:', errorText)
    return
  }

  const searchData = await searchRes.json()
  console.log('  Products found:', searchData.products?.length || 0)

  if (!searchData.products || searchData.products.length === 0) {
    console.log('  ❌ No products found for SKU:', TEST_SKU)
    return
  }

  const product = searchData.products[0]
  console.log('  Product object keys:', Object.keys(product).join(', '))

  const productId = product.id || product.productId || product.objectID || product.uuid

  console.log('  ✅ Product ID:', productId)
  console.log('  Name:', product.name || product.title)
  console.log()

  // 3. Get variants
  console.log('Step 2: Fetching variants...')
  const variantsUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants`

  console.log('  URL:', variantsUrl)

  const variantsRes = await fetch(variantsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  console.log('  Status:', variantsRes.status, variantsRes.statusText)

  if (!variantsRes.ok) {
    const errorText = await variantsRes.text()
    console.log('  ❌ Error Response:', errorText)

    // Try to parse as JSON
    try {
      const errorJson = JSON.parse(errorText)
      console.log('  Error Details:', JSON.stringify(errorJson, null, 2))
    } catch (e) {
      // Not JSON, already printed above
    }
    return
  }

  const variantsData = await variantsRes.json()

  // variantsData is directly an array of variants
  const variants = Array.isArray(variantsData) ? variantsData : (variantsData.variants || [])
  console.log('  Variants found:', variants.length)

  if (variants.length > 0) {
    console.log('  First variant keys:', Object.keys(variants[0]).join(', '))
    console.log('  Sample variants (first 3):')
    variants.slice(0, 3).forEach((v, i) => {
      console.log(`    ${i + 1}. Raw variant:`, JSON.stringify(v, null, 2).substring(0, 300))
    })
  }

  // Find matching size (using variantValue which is the size string)
  const variant = variants.find((v) =>
    String(v.variantValue) === TEST_SIZE ||
    String(v.sizeChart?.defaultConversion?.size) === TEST_SIZE
  )

  if (!variant) {
    console.log(`  ❌ Size ${TEST_SIZE} not found in variants`)
    return
  }

  const variantId = variant.variantId
  console.log(`  ✅ Found variant ID: ${variantId} for size ${TEST_SIZE}`)
  console.log(`  Variant value: ${variant.variantValue}`)
  console.log()

  // 4. Get market data
  console.log('Step 3: Fetching market data...')
  const marketUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variantId}/market-data?currencyCode=GBP`

  console.log('  URL:', marketUrl)

  const marketRes = await fetch(marketUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  console.log('  Status:', marketRes.status, marketRes.statusText)

  if (!marketRes.ok) {
    const errorText = await marketRes.text()
    console.log('  ❌ Error Response:', errorText)
    return
  }

  const marketData = await marketRes.json()
  console.log('  ✅ Market Data:')
  console.log('    Last Sale:', marketData.lastSaleAmount || 'N/A', marketData.lastSaleCurrency || '')
  console.log('    Lowest Ask:', marketData.lowestAskAmount || 'N/A', marketData.lowestAskCurrency || '')
  console.log('    Highest Bid:', marketData.highestBidAmount || 'N/A', marketData.highestBidCurrency || '')
  console.log()
  console.log('✅ All API calls successful!')
}

debugStockX().catch(console.error)
