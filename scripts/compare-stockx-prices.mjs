#!/usr/bin/env node
/**
 * Compare StockX API prices vs Website prices
 * Usage: node scripts/compare-stockx-prices.mjs <SKU> <SIZE>
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_SKU = process.argv[2] || 'DZ5485-612'
const TEST_SIZE = process.argv[3] || '10'

async function comparePrices() {
  console.log(`🔍 Comparing prices for ${TEST_SKU} Size ${TEST_SIZE}`)
  console.log()

  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
  const { data: account } = await supabase
    .from('stockx_accounts')
    .select('*')
    .eq('user_id', userId)
    .single()

  const accessToken = account.access_token
  const apiKey = process.env.STOCKX_API_KEY

  // Search for product
  const searchRes = await fetch(`https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(TEST_SKU)}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  const searchData = await searchRes.json()
  const product = searchData.products[0]
  const productId = product.productId || product.id

  console.log('✅ Product:', product.title)
  console.log()

  // Get variants
  const variantsRes = await fetch(`https://api.stockx.com/v2/catalog/products/${productId}/variants`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  })

  const variantsData = await variantsRes.json()
  const variants = Array.isArray(variantsData) ? variantsData : (variantsData.variants || [])

  // Find the size
  const variant = variants.find(v =>
    String(v.variantValue) === TEST_SIZE ||
    String(v.sizeChart?.defaultConversion?.size) === TEST_SIZE
  )

  if (!variant) {
    console.log('❌ Size not found')
    return
  }

  console.log('Size Info:')
  console.log('  US Size:', variant.variantValue)
  const ukSize = variant.sizeChart?.availableConversions?.find(c => c.type === 'uk')?.size
  const euSize = variant.sizeChart?.availableConversions?.find(c => c.type === 'eu')?.size
  console.log('  UK Size:', ukSize || 'N/A')
  console.log('  EU Size:', euSize || 'N/A')
  console.log()

  // Fetch prices in multiple currencies
  const currencies = ['GBP', 'USD', 'EUR']

  for (const currency of currencies) {
    const marketRes = await fetch(
      `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variant.variantId}/market-data?currencyCode=${currency}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      }
    )

    const marketData = await marketRes.json()

    console.log(`${currency} Prices:`)
    console.log('  Last Sale:', marketData.lastSaleAmount || 'N/A')
    console.log('  Lowest Ask:', marketData.lowestAskAmount || 'N/A')
    console.log('  Highest Bid:', marketData.highestBidAmount || 'N/A')
    console.log()
  }

  console.log('─'.repeat(80))
  console.log('NOTE: StockX website might show different prices due to:')
  console.log('  - Fees not included in API prices')
  console.log('  - Regional pricing differences')
  console.log('  - Currency conversion differences')
  console.log('  - Prices updating in real-time')
}

comparePrices().catch(console.error)
