#!/usr/bin/env node
/**
 * Check if StockX data was fetched with correct currency
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const sku = 'DM7866-001'

  console.log('\n💷 Currency Data Check\n')
  console.log('=' .repeat(80))

  // Get user's base currency
  const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
  const { data: profile } = await supabase
    .from('profiles')
    .select('base_currency')
    .eq('id', userId)
    .single()

  console.log(`\n👤 User base currency: ${profile?.base_currency || 'Not set'}\n`)

  // Get latest prices from stockx_latest_prices view
  const { data: prices, error } = await supabase
    .from('stockx_latest_prices')
    .select('sku, size, currency, last_sale, lowest_ask, highest_bid, as_of')
    .eq('sku', sku)

  if (error) {
    console.error('❌ Error fetching prices:', error)
    return
  }

  if (!prices || prices.length === 0) {
    console.log(`⚠️  No price data found for SKU: ${sku}`)

    // Check stockx_market_prices table directly
    const { data: rawPrices } = await supabase
      .from('stockx_market_prices')
      .select('sku, size, currency, last_sale_amount, lowest_ask_amount, highest_bid_amount, fetched_at')
      .eq('sku', sku)
      .order('fetched_at', { ascending: false })
      .limit(5)

    if (rawPrices && rawPrices.length > 0) {
      console.log(`\n✅ Found ${rawPrices.length} records in stockx_market_prices:\n`)
      for (const price of rawPrices) {
        const symbol = price.currency === 'GBP' ? '£' : price.currency === 'EUR' ? '€' : '$'
        console.log(`   ${price.sku}${price.size ? ':' + price.size : ''}`)
        console.log(`   Currency: ${price.currency}`)
        if (price.last_sale_amount) {
          console.log(`   Last Sale: ${symbol}${price.last_sale_amount}`)
          console.log(`   Lowest Ask: ${symbol}${price.lowest_ask_amount}`)
          console.log(`   Highest Bid: ${symbol}${price.highest_bid_amount}`)
        }
        console.log(`   Fetched: ${new Date(price.fetched_at).toLocaleString()}`)
        console.log('')
      }
    } else {
      console.log('   No records in stockx_market_prices either')
    }
    return
  }

  console.log(`✅ Found ${prices.length} size variants:\n`)

  for (const price of prices) {
    const symbol = price.currency === 'GBP' ? '£' : price.currency === 'EUR' ? '€' : '$'
    const currencyMatch = price.currency === profile?.base_currency ? '✅' : '❌'

    console.log(`${currencyMatch} Size ${price.size || 'N/A'} - Currency: ${price.currency}`)
    if (price.last_sale) {
      console.log(`   Last Sale: ${symbol}${price.last_sale}`)
      console.log(`   Lowest Ask: ${symbol}${price.lowest_ask}`)
      console.log(`   Highest Bid: ${symbol}${price.highest_bid}`)
    }
    console.log(`   Updated: ${new Date(price.as_of).toLocaleString()}`)
    console.log('')
  }

  if (profile?.base_currency) {
    const allMatch = prices.every(p => p.currency === profile.base_currency)
    if (allMatch) {
      console.log('🎉 SUCCESS! All prices match user\'s base currency!')
    } else {
      console.log('⚠️  WARNING: Some prices don\'t match user\'s base currency')
    }
  }
}

main().catch(console.error)
