#!/usr/bin/env node
/**
 * Check GBP Market Prices
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkPrices() {
  // Check recent GBP prices
  const { data: gbpPrices } = await supabase
    .from('stockx_market_prices')
    .select('sku, size, currency, last_sale, lowest_ask, highest_bid, as_of')
    .eq('currency', 'GBP')
    .order('as_of', { ascending: false })
    .limit(10)

  console.log('Recent GBP Prices:')
  console.log('─'.repeat(80))
  gbpPrices?.forEach(price => {
    const time = price.as_of ? new Date(price.as_of).toLocaleString() : 'unknown'
    console.log(`${price.sku}:${price.size || 'N/A'}`)
    console.log(`  Currency: ${price.currency}`)
    console.log(`  Last Sale: £${price.last_sale || 'N/A'} | Ask: £${price.lowest_ask || 'N/A'} | Bid: £${price.highest_bid || 'N/A'}`)
    console.log(`  Updated: ${time}`)
    console.log()
  })

  // Check USD vs GBP counts
  const { count: usdCount } = await supabase
    .from('stockx_market_prices')
    .select('*', { count: 'exact', head: true })
    .eq('currency', 'USD')

  const { count: gbpCount } = await supabase
    .from('stockx_market_prices')
    .select('*', { count: 'exact', head: true })
    .eq('currency', 'GBP')

  console.log('Currency Summary:')
  console.log('─'.repeat(80))
  console.log(`  USD prices: ${usdCount || 0}`)
  console.log(`  GBP prices: ${gbpCount || 0}`)
  console.log()
}

checkPrices()
