#!/usr/bin/env node
/**
 * Fetch and seed market data for AA2261-100 UK10.5 into stockx_market_latest
 * Uses StockX services directly
 */
import { createClient } from '@supabase/supabase-js'
import { getStockxClient } from '../src/lib/services/stockx/client.ts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'
const variantId = '64c90bc2-326f-45db-acce-1c2e3016a750'
const currencyCode = 'GBP'

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b' // User from logs

console.log('\n📥 Fetching fresh market data from StockX API...\n')
console.log(`   Product: ${productId}`)
console.log(`   Variant: ${variantId}`)
console.log(`   Currency: ${currencyCode}\n`)

try {
  const client = getStockxClient(userId)

  // Fetch market data for the product
  const url = `/v2/catalog/products/${productId}/market-data?currencyCode=${currencyCode}`
  console.log(`🔗 Calling StockX: ${url}`)

  const response = await client.request(url)
  console.log('\n📊 API Response:', JSON.stringify(response, null, 2).substring(0, 500) + '...')

  // Find the specific variant in the response
  const variants = response.variants || []
  const targetVariant = variants.find((v) => v.variantId === variantId || v.id === variantId)

  if (!targetVariant) {
    console.error(`\n❌ Variant ${variantId} not found in API response`)
    console.log(`Available variants: ${variants.map((v) => v.id || v.variantId).join(', ')}`)
    process.exit(1)
  }

  // Extract market data from variant
  const lastSale = targetVariant.lastSale ? Math.round(targetVariant.lastSale * 100) : null
  const lowestAsk = targetVariant.lowestAsk ? Math.round(targetVariant.lowestAsk * 100) : null
  const highestBid = targetVariant.highestBid ? Math.round(targetVariant.highestBid * 100) : null
  const salesLast72h = targetVariant.salesLast72Hours || 0

  console.log('\n💰 Market data to insert:')
  console.log(`   Last Sale: ${lastSale ? `£${(lastSale / 100).toFixed(2)}` : '—'}`)
  console.log(`   Lowest Ask: ${lowestAsk ? `£${(lowestAsk / 100).toFixed(2)}` : '—'}`)
  console.log(`   Highest Bid: ${highestBid ? `£${(highestBid / 100).toFixed(2)}` : '—'}`)
  console.log(`   Sales (72h): ${salesLast72h}`)

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
      sales_last_72h: salesLast72h,
      as_of: new Date().toISOString(),
    }, {
      onConflict: 'stockx_product_id,stockx_variant_id,currency_code',
    })

  if (insertError) {
    console.error('\n❌ Failed to insert:', insertError.message)
    process.exit(1)
  }

  console.log('\n✅ Market data successfully seeded to stockx_market_latest')
  console.log('✅ useInventoryV3 should now show correct prices')
  console.log('✅ Refresh the inventory page to see the changes\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
}
