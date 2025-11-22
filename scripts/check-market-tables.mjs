#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking market data tables for AA2261-100...\n')

// Check old table (stockx_market_prices)
console.log('📊 stockx_market_prices (OLD table - SKU + size based):')
const { data: oldPrices, error: oldError } = await supabase
  .from('stockx_market_prices')
  .select('*')
  .eq('sku', 'AA2261-100')
  .eq('size', '10.5')

if (oldError) {
  console.error('  ❌ Error:', oldError.message)
} else if (!oldPrices || oldPrices.length === 0) {
  console.log('  ❌ No data found')
} else {
  const price = oldPrices[0]
  console.log(`  ✅ Found data:`)
  console.log(`     Last Sale: ${price.last_sale ? `£${(price.last_sale / 100).toFixed(2)}` : '—'}`)
  console.log(`     Lowest Ask: ${price.lowest_ask ? `£${(price.lowest_ask / 100).toFixed(2)}` : '—'}`)
  console.log(`     Highest Bid: ${price.highest_bid ? `£${(price.highest_bid / 100).toFixed(2)}` : '—'}`)
  console.log(`     Currency: ${price.currency}`)
  console.log(`     Updated: ${price.as_of}\n`)
}

// Check new table (stockx_market_latest)
console.log('📊 stockx_market_latest (NEW table - productId + variantId based):')
const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'
const variantId = '64c90bc2-326f-45db-acce-1c2e3016a750'

const { data: newPrices, error: newError } = await supabase
  .from('stockx_market_latest')
  .select('*')
  .eq('stockx_product_id', productId)
  .eq('stockx_variant_id', variantId)
  .eq('currency_code', 'GBP')

if (newError) {
  console.error('  ❌ Error:', newError.message)
} else if (!newPrices || newPrices.length === 0) {
  console.log('  ❌ No data found')
  console.log(`     Needed: productId=${productId}, variantId=${variantId}, currency=GBP`)
} else {
  const price = newPrices[0]
  console.log(`  ✅ Found data:`)
  console.log(`     Last Sale: ${price.last_sale ? `£${(price.last_sale / 100).toFixed(2)}` : '—'}`)
  console.log(`     Lowest Ask: ${price.lowest_ask ? `£${(price.lowest_ask / 100).toFixed(2)}` : '—'}`)
  console.log(`     Highest Bid: ${price.highest_bid ? `£${(price.highest_bid / 100).toFixed(2)}` : '—'}`)
  console.log(`     Currency: ${price.currency_code}`)
  console.log(`     Updated: ${price.as_of}\n`)
}

console.log('💡 Summary:')
if (oldPrices?.length > 0 && (!newPrices || newPrices.length === 0)) {
  console.log('  ⚠️  Data exists in OLD table but not in NEW table')
  console.log('  ⚠️  This causes the modal and useInventoryV3 to show different data')
  console.log('  ✅  Solution: Migrate data from old table to new table\n')
} else if (newPrices?.length > 0) {
  console.log('  ✅  Data is in NEW table - everything should work\n')
} else {
  console.log('  ❌  No market data in either table\n')
}
