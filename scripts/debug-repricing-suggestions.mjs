/**
 * Debug Repricing Suggestions
 * Check why repricing suggestions aren't showing up
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugRepricingSuggestions() {
  try {
    console.log('🔍 Debugging Repricing Suggestions\n')

    // Get first user (for testing)
    const { data: users } = await supabase
      .from('Inventory')
      .select('user_id')
      .limit(1)

    if (!users || users.length === 0) {
      console.log('❌ No inventory items found')
      return
    }

    const userId = users[0].user_id
    console.log(`📊 Checking inventory for user: ${userId}\n`)

    // Fetch available inventory with market data
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('Inventory')
      .select('*, inventory_market_links(*)')
      .eq('user_id', userId)
      .eq('status', 'available')
      .order('purchase_date', { ascending: true })

    if (inventoryError) {
      console.error('❌ Error fetching inventory:', inventoryError)
      return
    }

    console.log(`📦 Total available inventory: ${inventoryData?.length || 0}`)

    if (!inventoryData || inventoryData.length === 0) {
      console.log('\n❌ No available inventory found')
      return
    }

    const now = new Date()
    let itemsOver30Days = 0
    let itemsWithMarketData = 0
    let itemsWithPriceIssues = 0
    let eligibleForRepricing = 0

    console.log('\n📋 Inventory Analysis:\n')

    for (const item of inventoryData) {
      const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
      const daysInInventory = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysInInventory < 30) {
        continue // Too fresh
      }

      itemsOver30Days++

      const purchaseCost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
      const currentPrice = item.custom_market_value || purchaseCost * 1.2

      // Get market data
      const marketLinks = item.inventory_market_links || []
      let marketLowestAsk = null
      let marketHighestBid = null

      for (const link of marketLinks) {
        if (link.lowest_ask && (!marketLowestAsk || link.lowest_ask < marketLowestAsk)) {
          marketLowestAsk = link.lowest_ask
        }
        if (link.highest_bid && (!marketHighestBid || link.highest_bid > marketHighestBid)) {
          marketHighestBid = link.highest_bid
        }
      }

      const hasMarketData = marketLowestAsk || marketHighestBid

      console.log(`\n  SKU: ${item.sku}`)
      console.log(`  Age: ${daysInInventory} days`)
      console.log(`  Current Price: £${currentPrice.toFixed(2)}`)
      console.log(`  Purchase Cost: £${purchaseCost.toFixed(2)}`)
      console.log(`  Market Data: ${hasMarketData ? '✅' : '❌'}`)

      if (marketLowestAsk) {
        console.log(`  Market Lowest Ask: £${marketLowestAsk.toFixed(2)}`)
        itemsWithMarketData++
      }
      if (marketHighestBid) {
        console.log(`  Market Highest Bid: £${marketHighestBid.toFixed(2)}`)
      }

      // Determine if eligible for repricing
      let eligible = false
      let reason = ''

      if (daysInInventory >= 180) {
        eligible = true
        reason = 'Dead stock (180+ days) - aggressive markdown'
      } else if (daysInInventory >= 90) {
        eligible = true
        reason = 'Stale inventory (90-179 days) - moderate markdown'
      } else if (daysInInventory >= 30) {
        // Only repriced if overpriced vs market
        if (marketLowestAsk && currentPrice > marketLowestAsk) {
          eligible = true
          reason = 'Aging inventory - priced above market'
        } else {
          reason = 'Aging inventory - already competitive'
        }
      }

      if (eligible) {
        eligibleForRepricing++
        console.log(`  ✅ ELIGIBLE: ${reason}`)
      } else {
        console.log(`  ❌ NOT ELIGIBLE: ${reason}`)
        itemsWithPriceIssues++
      }
    }

    console.log('\n\n📊 Summary:')
    console.log(`  Total available items: ${inventoryData.length}`)
    console.log(`  Items > 30 days old: ${itemsOver30Days}`)
    console.log(`  Items with market data: ${itemsWithMarketData}`)
    console.log(`  Items eligible for repricing: ${eligibleForRepricing}`)
    console.log(`  Items not eligible: ${itemsWithPriceIssues}`)

    if (eligibleForRepricing === 0) {
      console.log('\n❌ No items eligible for repricing because:')
      if (itemsOver30Days === 0) {
        console.log('  • All inventory is less than 30 days old (too fresh)')
      }
      if (itemsWithMarketData === 0 && itemsOver30Days > 0) {
        console.log('  • No market data available for aging inventory')
      }
      if (itemsWithPriceIssues > 0) {
        console.log(`  • ${itemsWithPriceIssues} items are already priced competitively`)
      }
    } else {
      console.log(`\n✅ Expected to see ${eligibleForRepricing} repricing suggestions`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugRepricingSuggestions()
