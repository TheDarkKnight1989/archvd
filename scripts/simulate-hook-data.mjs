#!/usr/bin/env node
/**
 * Simulate Exact Hook Data Output
 * Shows exactly what the UI will display
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

async function simulateHook() {
  console.log('=== SIMULATING HOOK OUTPUT (What You\'ll See) ===')
  console.log()

  // Get user currency
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency_pref')
    .eq('id', userId)
    .single()
  const userCurrency = profile?.currency_pref || 'GBP'

  // Get inventory items
  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, model, market_value')
    .eq('user_id', userId)
    .eq('status', 'active')

  // Get StockX links
  const { data: links } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider_product_sku')
    .eq('provider', 'stockx')

  const linkMap = new Map()
  links?.forEach(link => {
    linkMap.set(link.inventory_id, link.provider_product_sku)
  })

  // Get StockX prices
  const { data: prices } = await supabase
    .from('stockx_latest_prices')
    .select('sku, size, currency, lowest_ask, last_sale')
    .eq('currency', userCurrency)

  const priceMap = new Map()
  prices?.forEach(price => {
    priceMap.set(`${price.sku}:${price.size}`, price)
  })

  // Enrich items (simulate hook logic)
  console.log('Portfolio Items (Enriched):')
  console.log('─'.repeat(80))

  let withPrices = 0
  let noPrices = 0

  items?.forEach((item, i) => {
    const stockxSku = linkMap.get(item.id)

    if (stockxSku) {
      // NORMALIZE SIZE - This is what the hook does!
      const normalizedSize = item.size?.replace(/^UK/i, '') || item.size
      const priceKey = `${stockxSku}:${normalizedSize}`
      const stockxPrice = priceMap.get(priceKey)

      if (stockxPrice) {
        const marketPrice = stockxPrice.last_sale || stockxPrice.lowest_ask
        console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
        console.log(`   Market Value: £${marketPrice} (StockX)`)
        withPrices++
      } else {
        console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
        console.log(`   Market Value: No price (no match for ${priceKey})`)
        noPrices++
      }
    } else {
      console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
      console.log(`   Market Value: No price (no StockX link)`)
      noPrices++
    }
  })

  console.log()
  console.log('─'.repeat(80))
  console.log(`✅ Items with prices: ${withPrices}`)
  console.log(`❌ Items without prices: ${noPrices}`)
}

simulateHook().catch(console.error)
