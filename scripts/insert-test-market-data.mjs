#!/usr/bin/env node
/**
 * Insert test market data for AA2261-100 UK10.5 into stockx_market_latest
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'
const variantId = '64c90bc2-326f-45db-acce-1c2e3016a750'
const currencyCode = 'GBP'

console.log('\n📥 Inserting test market data for testing...\n')
console.log(`   Product: ${productId}`)
console.log(`   Variant: ${variantId}`)
console.log(`   Currency: ${currencyCode}\n`)

// Test data (prices in MAJOR currency units - DB convention)
const lastSale = 389.40  // £389.40
const lowestAsk = 412.00  // £412.00
const highestBid = 365.00  // £365.00
const salesLast72h = 5

console.log('💰 Test market data to insert:')
console.log(`   Last Sale: £${lastSale.toFixed(2)}`)
console.log(`   Lowest Ask: £${lowestAsk.toFixed(2)}`)
console.log(`   Highest Bid: £${highestBid.toFixed(2)}`)
console.log(`   Sales (72h): ${salesLast72h}`)

try {
  // Insert into stockx_market_snapshots (base table)
  const { error: insertError } = await supabase
    .from('stockx_market_snapshots')
    .insert({
      stockx_product_id: productId,
      stockx_variant_id: variantId,
      currency_code: currencyCode,
      last_sale_price: lastSale,
      lowest_ask: lowestAsk,
      highest_bid: highestBid,
      snapshot_at: new Date().toISOString(),
    })

  if (insertError) {
    console.error('\n❌ Failed to insert:', insertError.message)
    process.exit(1)
  }

  console.log('\n✅ Test market data successfully inserted to stockx_market_latest')
  console.log('✅ useInventoryV3 should now populate item.stockx.{lastSale, lowestAsk, highestBid}')
  console.log('✅ ListOnStockXModal should display these exact prices')
  console.log('\n🔄 Refresh the inventory page at http://localhost:3000/portfolio/inventory')
  console.log('🎯 Click "List on StockX" for AA2261-100 to verify the modal shows correct prices\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
