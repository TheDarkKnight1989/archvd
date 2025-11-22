#!/usr/bin/env node
/**
 * Fetch and seed market data for AA2261-100 UK10.5 into stockx_market_latest
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'
const variantId = '64c90bc2-326f-45db-acce-1c2e3016a750'
const currencyCode = 'GBP'

console.log('\n📥 Fetching fresh market data from StockX API...\n')
console.log(`   Product: ${productId}`)
console.log(`   Variant: ${variantId}`)
console.log(`   Currency: ${currencyCode}\n`)

try {
  // Fetch from StockX API via our endpoint
  const apiUrl = `http://localhost:3000/api/stockx/products/${productId}/market-data?variantId=${variantId}&currency=${currencyCode}`

  console.log(`🔗 Calling: ${apiUrl}`)
  const response = await fetch(apiUrl)

  if (!response.ok) {
    const error = await response.json()
    console.error('❌ API call failed:', error)
    process.exit(1)
  }

  const data = await response.json()
  console.log('\n📊 API Response:', JSON.stringify(data, null, 2))

  if (!data.variantId) {
    console.error('❌ No variant data in response')
    process.exit(1)
  }

  // Extract market data
  const lastSale = data.lastSale || null
  const lowestAsk = data.lowestAsk || null
  const highestBid = data.highestBid || null

  console.log('\n💰 Market data to insert:')
  console.log(`   Last Sale: ${lastSale ? `£${(lastSale / 100).toFixed(2)}` : '—'}`)
  console.log(`   Lowest Ask: ${lowestAsk ? `£${(lowestAsk / 100).toFixed(2)}` : '—'}`)
  console.log(`   Highest Bid: ${highestBid ? `£${(highestBid / 100).toFixed(2)}` : '—'}`)

  // Insert into stockx_market_latest
  const { error: insertError } = await supabase
    .from('stockx_market_latest')
    .upsert({
      stockx_product_id: productId,
      stockx_variant_id: variantId,
      currency_code: currencyCode,
      last_sale: lastSale,
      lowest_ask: lowestAsk,
      highest_bid: highestBid,
      sales_last_72h: data.salesLast72Hours || 0,
      as_of: new Date().toISOString(),
    }, {
      onConflict: 'stockx_product_id,stockx_variant_id,currency_code',
    })

  if (insertError) {
    console.error('\n❌ Failed to insert:', insertError.message)
    process.exit(1)
  }

  console.log('\n✅ Market data successfully seeded to stockx_market_latest')
  console.log('✅ useInventoryV3 should now show correct prices\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
