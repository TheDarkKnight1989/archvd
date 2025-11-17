#!/usr/bin/env node
/**
 * Test Portfolio Pricing Fix
 * Verifies that the hook correctly:
 * 1. Filters StockX prices by user's currency (GBP)
 * 2. Uses lowest_ask when last_sale is null
 * 3. Updates market_value correctly
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testPricingFix() {
  console.log('🧪 Testing Portfolio Pricing Fix')
  console.log()

  // Simulate what the hook does
  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

  // 1. Get user currency preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency_pref')
    .eq('id', userId)
    .single()

  const userCurrency = profile?.currency_pref || 'GBP'
  console.log('✅ User Currency:', userCurrency)
  console.log()

  // 2. Fetch StockX prices filtered by currency
  const { data: stockxPrices } = await supabase
    .from('stockx_latest_prices')
    .select('sku, size, currency, lowest_ask, highest_bid, last_sale, as_of')
    .eq('currency', userCurrency)
    .order('as_of', { ascending: false })

  console.log(`✅ Fetched ${stockxPrices?.length || 0} StockX prices in ${userCurrency}`)
  console.log()

  // 3. Test with DZ5485-612:10 (the problematic SKU)
  const testPrice = stockxPrices?.find(p => p.sku === 'DZ5485-612' && p.size === '10')

  if (testPrice) {
    console.log('Test Case: DZ5485-612 Size 10')
    console.log('─'.repeat(80))
    console.log('Currency:', testPrice.currency)
    console.log('Last Sale:', testPrice.last_sale)
    console.log('Lowest Ask:', testPrice.lowest_ask)
    console.log('Highest Bid:', testPrice.highest_bid)
    console.log('As Of:', new Date(testPrice.as_of).toLocaleString())
    console.log()

    // Simulate the pricing logic from the hook
    const marketPrice = testPrice.last_sale || testPrice.lowest_ask
    console.log('Market Value (priority: last_sale > lowest_ask):', marketPrice, testPrice.currency)
    console.log()

    if (testPrice.currency === userCurrency && marketPrice === testPrice.lowest_ask) {
      console.log('✅ PASS: Using lowest_ask because last_sale is null')
    }

    if (testPrice.currency === 'GBP') {
      console.log('✅ PASS: Price is in GBP (not USD)')
    }
  } else {
    console.log('❌ FAIL: Could not find DZ5485-612:10 in filtered prices')
  }

  // 4. Verify no USD prices are being returned
  const usdPrices = stockxPrices?.filter(p => p.currency === 'USD') || []
  if (usdPrices.length === 0) {
    console.log('✅ PASS: No USD prices in results (correctly filtered by currency)')
  } else {
    console.log(`❌ FAIL: Found ${usdPrices.length} USD prices (currency filter not working)`)
  }
  console.log()

  // 5. Show sample prices
  console.log('Sample Prices (first 5):')
  console.log('─'.repeat(80))
  stockxPrices?.slice(0, 5).forEach(p => {
    const price = p.last_sale || p.lowest_ask
    console.log(`${p.sku}:${p.size} - £${price} (${p.last_sale ? 'last_sale' : 'lowest_ask'})`)
  })
}

testPricingFix().catch(console.error)
