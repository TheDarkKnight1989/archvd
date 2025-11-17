#!/usr/bin/env node
/**
 * Debug User's Actual Portfolio Data
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

async function debugUserData() {
  console.log('=== DEBUGGING ACTUAL DATA FLOW ===')
  console.log()

  // Step 1: Get user's currency preference
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency_pref')
    .eq('id', userId)
    .single()

  const userCurrency = profile?.currency_pref || 'GBP'
  console.log('User Currency Preference:', userCurrency)
  console.log()

  // Step 2: Get ALL user's items
  const { data: allItems } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, market_value, status')
    .eq('user_id', userId)

  console.log('Total items:', allItems?.length || 0)

  // Group by status
  const byStatus = {}
  allItems?.forEach(item => {
    const status = item.status || 'null'
    if (!byStatus[status]) byStatus[status] = []
    byStatus[status].push(item)
  })

  console.log()
  console.log('Items by status:')
  Object.entries(byStatus).forEach(([status, items]) => {
    console.log(`  ${status}: ${items.length}`)
  })
  console.log()

  // Step 3: Show active items with current values
  const activeItems = allItems?.filter(i => i.status === 'active') || []
  console.log('ACTIVE ITEMS (what Portfolio page should show):')
  console.log('─'.repeat(80))

  if (activeItems.length === 0) {
    console.log('❌ NO ACTIVE ITEMS FOUND')
    console.log()
    return
  }

  for (const item of activeItems) {
    console.log()
    console.log(`${item.brand || 'Unknown'} - ${item.sku}:${item.size}`)
    console.log(`  Current market_value in DB: £${item.market_value || 'N/A'}`)

    // Check if it has StockX link
    const { data: links } = await supabase
      .from('inventory_market_links')
      .select('provider_product_sku')
      .eq('inventory_id', item.id)
      .eq('provider', 'stockx')
      .single()

    if (links) {
      console.log(`  ✅ Has StockX link: ${links.provider_product_sku}`)

      // Check if we have a price for this
      const { data: price } = await supabase
        .from('stockx_latest_prices')
        .select('currency, lowest_ask, last_sale, as_of')
        .eq('sku', links.provider_product_sku)
        .eq('size', item.size)
        .eq('currency', userCurrency)
        .single()

      if (price) {
        const marketPrice = price.last_sale || price.lowest_ask
        console.log(`  ✅ StockX price available: £${marketPrice} ${price.currency}`)
        console.log(`     (last_sale: ${price.last_sale || 'null'}, lowest_ask: ${price.lowest_ask})`)
        console.log(`     Fetched: ${new Date(price.as_of).toLocaleString()}`)

        if (item.market_value !== marketPrice) {
          console.log(`  ⚠️  MISMATCH: DB has £${item.market_value}, should show £${marketPrice}`)
        } else {
          console.log(`  ✅ MATCH: Values are the same`)
        }
      } else {
        console.log(`  ❌ No StockX price found for ${links.provider_product_sku}:${item.size} in ${userCurrency}`)
      }
    } else {
      console.log(`  ❌ No StockX link`)
    }
  }

  console.log()
  console.log('─'.repeat(80))
  console.log('Summary:')
  console.log(`  Total active items: ${activeItems.length}`)
  console.log(`  Items with StockX links: checking...`)
}

debugUserData().catch(console.error)
