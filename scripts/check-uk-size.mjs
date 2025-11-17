#!/usr/bin/env node
/**
 * Check UK Size Conversion for DZ5485-612
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_SKU = 'DZ5485-612'

async function checkUKSize() {
  // Get OAuth token
  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
  const { data: account } = await supabase
    .from('stockx_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  const accessToken = account.access_token
  const apiKey = process.env.STOCKX_API_KEY

  console.log('🔍 Checking DZ5485-612 sizes on StockX API')
  console.log()

  // 1. Search for product
  const searchUrl = `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(TEST_SKU)}`
  const searchRes = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!searchRes.ok) {
    console.log('❌ Search failed:', searchRes.status)
    return
  }

  const searchData = await searchRes.json()
  const product = searchData.products[0]
  const productId = product.productId || product.id

  console.log('✅ Product found:', product.title)
  console.log()

  // 2. Get variants
  const variantsUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants`
  const variantsRes = await fetch(variantsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  const variantsData = await variantsRes.json()
  const variants = Array.isArray(variantsData) ? variantsData : (variantsData.variants || [])

  console.log('Available sizes with UK conversions:')
  console.log('─'.repeat(80))

  // Show all variants with UK sizing
  variants.forEach(v => {
    const usSize = v.variantValue
    const ukSize = v.sizeChart?.availableConversions?.find(c => c.type === 'uk')?.size
    const euSize = v.sizeChart?.availableConversions?.find(c => c.type === 'eu')?.size

    console.log(`US ${usSize} = UK ${ukSize || 'N/A'} = EU ${euSize || 'N/A'}`)
  })

  console.log()
  console.log('Looking for UK 10...')

  // Find UK 10
  const ukSizes = variants.map(v => ({
    usSize: v.variantValue,
    ukSize: v.sizeChart?.availableConversions?.find(c => c.type === 'uk')?.size,
    variantId: v.variantId
  }))

  const uk10Variant = ukSizes.find(s => s.ukSize === '10')

  if (uk10Variant) {
    console.log(`✅ UK 10 = US ${uk10Variant.usSize}`)
    console.log()

    // Fetch market data for UK 10
    const marketUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants/${uk10Variant.variantId}/market-data?currencyCode=GBP`
    const marketRes = await fetch(marketUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    })

    const marketData = await marketRes.json()
    console.log('Market Data for UK 10:')
    console.log('  Lowest Ask:', marketData.lowestAskAmount, 'GBP')
    console.log('  Highest Bid:', marketData.highestBidAmount, 'GBP')
  } else {
    console.log('❌ UK 10 not found')
  }
}

checkUKSize().catch(console.error)
