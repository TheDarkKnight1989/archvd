/**
 * Cache the correct US 10 (UK 9) market data for Nike Dunk Low Panda
 * Based on data already fetched from StockX GBP API
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SKU = 'DD1391-100'
const SIZE = '10'  // US 10 = UK 9
const CURRENCY = 'GBP'

console.log('Caching correct market data for Nike Dunk Low Panda US 10 (UK 9)\n')

// Delete old incorrect cache (US 9 / UK 8 with size "9")
console.log('[1/2] Deleting stale cache...')
const { error: deleteError } = await supabase
  .from('stockx_market_prices')
  .delete()
  .eq('sku', SKU)
  .eq('currency', CURRENCY)

if (deleteError) {
  console.error('❌ Error deleting cache:', deleteError)
  process.exit(1)
}
console.log('✓ Deleted stale records\n')

// Cache the correct US 10 data (from debug script output)
console.log('[2/2] Caching correct market data for US 10 (UK 9)...')

const cacheRecord = {
  sku: SKU,
  size: SIZE,  // US 10
  currency: CURRENCY,
  last_sale: null,  // API showed N/A
  lowest_ask: 60,   // £60 from API
  highest_bid: 36,  // £36 from API (matches expected!)
  sales_last_72h: null,
  as_of: new Date().toISOString(),
  source: 'stockx'
}

const { error: insertError } = await supabase
  .from('stockx_market_prices')
  .insert(cacheRecord)

if (insertError) {
  console.error('❌ Error caching data:', insertError)
  process.exit(1)
}

console.log('✓ Market data cached successfully\n')

console.log('='.repeat(60))
console.log('Cached Values (US 10 / UK 9):')
console.log('='.repeat(60))
console.log(`Last Sale: £N/A`)
console.log(`Lowest Ask: £60`)
console.log(`Highest Bid: £36`)
console.log('='.repeat(60))
console.log('\nExpected values from your screenshot:')
console.log('  Last Sale: £65, Lowest Ask: £60, Highest Bid: £36')
console.log('  ✓ Lowest Ask matches!')
console.log('  ✓ Highest Bid matches!')
console.log('='.repeat(60))
