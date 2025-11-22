#!/usr/bin/env node
/**
 * Full simulation of useInventoryV3 logic to debug price display
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Use anon key like the hook does
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'
const userCurrency = 'GBP' // Default for this user

console.log('\n🔍 Full Hook Simulation - useInventoryV3\n')

// Step 1: Fetch inventory items
const { data: inventoryData } = await supabase
  .from('Inventory')
  .select('*')
  .in('status', ['active', 'listed', 'worn'])
  .order('created_at', { ascending: false })

console.log(`✅ Fetched ${inventoryData?.length || 0} inventory items`)

// Step 2: Fetch StockX mappings
const { data: stockxMappings } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id')

console.log(`✅ Fetched ${stockxMappings?.length || 0} StockX mappings`)

// Step 3: Fetch StockX market prices
const { data: stockxPrices, error: stockxPricesError } = await supabase
  .from('stockx_market_latest')
  .select('stockx_product_id, stockx_variant_id, currency_code, last_sale_price, lowest_ask, highest_bid, snapshot_at')

console.log('\n📊 StockX prices fetched:', {
  count: stockxPrices?.length || 0,
  error: stockxPricesError,
  sample: stockxPrices?.[0]
})

if (stockxPricesError) {
  console.error('❌ Error fetching prices:', stockxPricesError)
  process.exit(1)
}

// Build price map (same logic as hook)
const stockxPriceMap = new Map()
if (stockxPrices) {
  for (const price of stockxPrices) {
    const key = `${price.stockx_product_id}:${price.stockx_variant_id}:${price.currency_code}`
    stockxPriceMap.set(key, price)
  }
}

console.log(`\n🗺️  Built price map with ${stockxPriceMap.size} entries`)
console.log('Sample keys:', Array.from(stockxPriceMap.keys()).slice(0, 3))

// Build mapping map
const stockxMappingMap = new Map()
if (stockxMappings) {
  for (const mapping of stockxMappings) {
    stockxMappingMap.set(mapping.item_id, mapping)
  }
}

console.log(`\n🗺️  Built mapping map with ${stockxMappingMap.size} entries`)

// Now test price lookup for each mapped item
console.log('\n🔍 Testing price lookup for each mapped inventory item:\n')

let foundCount = 0
let notFoundCount = 0

if (inventoryData) {
  for (const item of inventoryData) {
    const stockxMapping = stockxMappingMap.get(item.id)

    if (!stockxMapping) {
      console.log(`⚪ ${item.sku}: No StockX mapping`)
      continue
    }

    // Try to get price in user's currency first (same logic as hook)
    const priceKeyUser = `${stockxMapping.stockx_product_id}:${stockxMapping.stockx_variant_id}:${userCurrency}`
    let stockxPrice = stockxPriceMap.get(priceKeyUser)

    if (stockxPrice) {
      foundCount++
      console.log(`✅ ${item.sku}: Found price (${userCurrency})`, {
        lastSale: stockxPrice.last_sale_price,
        lowestAsk: stockxPrice.lowest_ask,
        highestBid: stockxPrice.highest_bid
      })
    } else {
      // Try fallback currencies
      const fallbackCurrencies = ['USD', 'EUR', 'GBP'].filter(c => c !== userCurrency)
      let found = false

      for (const currency of fallbackCurrencies) {
        const priceKey = `${stockxMapping.stockx_product_id}:${stockxMapping.stockx_variant_id}:${currency}`
        const fallbackPrice = stockxPriceMap.get(priceKey)
        if (fallbackPrice) {
          foundCount++
          found = true
          console.log(`✅ ${item.sku}: Found price (${currency} fallback)`, {
            lastSale: fallbackPrice.last_sale_price,
            lowestAsk: fallbackPrice.lowest_ask,
            highestBid: fallbackPrice.highest_bid
          })
          break
        }
      }

      if (!found) {
        notFoundCount++
        console.log(`❌ ${item.sku}: No price found`, {
          productId: stockxMapping.stockx_product_id.substring(0, 8) + '...',
          variantId: stockxMapping.stockx_variant_id.substring(0, 8) + '...',
          searchedKey: priceKeyUser
        })
      }
    }
  }
}

console.log('\n📈 Summary:')
console.log(`   Inventory items: ${inventoryData?.length || 0}`)
console.log(`   StockX mappings: ${stockxMappings?.length || 0}`)
console.log(`   Price data found: ${foundCount}`)
console.log(`   Price data missing: ${notFoundCount}`)
console.log(`\nResult: ${foundCount > 0 ? '✅ At least one item should show prices' : '❌ No prices will display'}`)
