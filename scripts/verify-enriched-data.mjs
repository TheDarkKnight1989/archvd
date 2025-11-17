#!/usr/bin/env node
/**
 * Verify Enriched Portfolio Data
 * Simulates exactly what usePortfolioInventory hook returns
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

async function verifyEnrichedData() {
  console.log('🔍 VERIFYING ENRICHED DATA (What Hook Returns)')
  console.log('═'.repeat(80))
  console.log()

  // Step 1: Get user currency
  const { data: { user } } = await supabase.auth.getUser()
  let userCurrency = 'GBP'

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('currency_pref')
      .eq('id', userId)
      .single()

    if (profile?.currency_pref) {
      userCurrency = profile.currency_pref
    }
  }

  console.log(`✅ User Currency: ${userCurrency}`)
  console.log()

  // Step 2: Fetch inventory items
  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, model, market_value, status')
    .eq('user_id', userId)
    .eq('status', 'active')

  // Step 3: Fetch StockX links
  const { data: stockxLinks } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider_product_sku')
    .eq('provider', 'stockx')

  const stockxLinkMap = new Map()
  stockxLinks?.forEach(link => {
    stockxLinkMap.set(link.inventory_id, {
      product_sku: link.provider_product_sku
    })
  })

  // Step 4: Fetch StockX prices (FILTERED BY CURRENCY)
  const { data: stockxPrices } = await supabase
    .from('stockx_latest_prices')
    .select('sku, size, currency, lowest_ask, highest_bid, last_sale, as_of')
    .eq('currency', userCurrency)
    .order('as_of', { ascending: false })

  console.log(`✅ Fetched ${stockxPrices?.length || 0} StockX prices in ${userCurrency}`)
  console.log()

  const stockxPriceMap = new Map()
  stockxPrices?.forEach(price => {
    const key = `${price.sku}:${price.size}`
    stockxPriceMap.set(key, price)
  })

  // Step 5: Enrich items (EXACTLY LIKE THE HOOK)
  console.log('ENRICHED ITEMS (What Table Receives):')
  console.log('─'.repeat(80))

  let withBothPrices = 0
  let withAskOnly = 0
  let noPrices = 0

  items?.forEach((item, i) => {
    const stockxLink = stockxLinkMap.get(item.id)

    if (!stockxLink) {
      console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
      console.log(`   ❌ No StockX link`)
      console.log()
      noPrices++
      return
    }

    // NORMALIZE SIZE (strip UK prefix)
    const normalizedSize = item.size?.replace(/^UK/i, '') || item.size
    const priceKey = `${stockxLink.product_sku}:${normalizedSize}`
    const stockxPrice = stockxPriceMap.get(priceKey)

    if (!stockxPrice) {
      console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
      console.log(`   ❌ No price found for key: ${priceKey}`)
      console.log()
      noPrices++
      return
    }

    // This is what the hook returns
    const enrichedItem = {
      id: item.id,
      sku: item.sku,
      size: item.size,
      brand: item.brand,
      model: item.model,
      market_value: item.market_value,
      stockx_mapping_status: 'mapped',
      stockx_product_sku: stockxLink.product_sku,
      stockx_lowest_ask: stockxPrice.lowest_ask || null,
      stockx_highest_bid: stockxPrice.highest_bid || null,
      stockx_last_sale: stockxPrice.last_sale || null,
      stockx_price_as_of: stockxPrice.as_of || null,
      market_source: 'stockx',
      market_currency: stockxPrice.currency
    }

    console.log(`${i + 1}. ${item.brand} ${item.sku}:${item.size}`)
    console.log(`   ✅ Enriched Data:`)
    console.log(`      stockx_lowest_ask: £${enrichedItem.stockx_lowest_ask}`)
    console.log(`      stockx_highest_bid: £${enrichedItem.stockx_highest_bid || 'null'}`)
    console.log(`      stockx_last_sale: £${enrichedItem.stockx_last_sale || 'null'}`)
    console.log(`      market_currency: ${enrichedItem.market_currency}`)
    console.log(`      as_of: ${new Date(enrichedItem.stockx_price_as_of).toLocaleString()}`)
    console.log()

    if (enrichedItem.stockx_lowest_ask && enrichedItem.stockx_highest_bid) {
      withBothPrices++
    } else if (enrichedItem.stockx_lowest_ask) {
      withAskOnly++
    } else {
      noPrices++
    }
  })

  console.log('═'.repeat(80))
  console.log('SUMMARY:')
  console.log(`  ✅ Items with BOTH ask + bid: ${withBothPrices}`)
  console.log(`  ⚠️  Items with ask only: ${withAskOnly}`)
  console.log(`  ❌ Items with no prices: ${noPrices}`)
  console.log()
  console.log('═'.repeat(80))

  if (withBothPrices > 0) {
    console.log('✅ SUCCESS: Hook is enriching data with BOTH bid and ask!')
    console.log()
    console.log('If you don\'t see bid/ask in the UI, you need to:')
    console.log('  1. Hard refresh your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)')
    console.log('  2. Or clear browser cache for localhost:3000')
  } else {
    console.log('❌ ISSUE: No items have both bid and ask prices')
    console.log('Check if stockx_latest_prices table has highest_bid data')
  }
}

verifyEnrichedData().catch(console.error)
