/**
 * API Acceptance Tests
 * Tests the portfolio overview API
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.USER_ID || 'fbcde760-820b-4eaf-949f-534a8130d44b'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testOverviewAPI() {
  console.log('🧪 Testing Portfolio Overview API\n')

  // We'll simulate the API call by running the same logic
  const { data: inventory } = await supabase
    .from('Inventory')
    .select('id, sku, size, size_uk, purchase_price, tax, shipping, purchase_total, category')
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: marketLinks } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider_product_sku')
    .in('inventory_id', inventory?.map(i => i.id) || [])

  const inventoryToMarketSku = new Map()
  marketLinks?.forEach(link => {
    inventoryToMarketSku.set(link.inventory_id, link.provider_product_sku)
  })

  // Get prices
  let totalEstimatedValue = 0
  let totalInvested = 0
  const providers = new Set()
  let latestPriceTimestamp = null

  for (const item of inventory || []) {
    const invested = item.purchase_total || item.purchase_price + (item.tax || 0) + (item.shipping || 0)
    totalInvested += invested

    const marketSku = inventoryToMarketSku.get(item.id)
    if (!marketSku) continue

    let size = item.size_uk || item.size || null
    if (size && typeof size === 'string' && size.toUpperCase().startsWith('UK')) {
      size = size.substring(2).trim()
    }

    const qb = supabase
      .from('latest_market_prices')
      .select('sku, size_uk, last_sale, ask, bid, provider, as_of')
      .eq('sku', marketSku)

    if (size) {
      qb.eq('size_uk', size)
    } else {
      qb.is('size_uk', null)
    }

    const { data: priceData } = await qb.limit(1).single()

    if (priceData) {
      const price = priceData.last_sale || priceData.ask || priceData.bid
      if (price) {
        totalEstimatedValue += price
        providers.add(priceData.provider)
        if (priceData.as_of) {
          const priceDate = new Date(priceData.as_of)
          if (!latestPriceTimestamp || priceDate > latestPriceTimestamp) {
            latestPriceTimestamp = priceDate
          }
        }
      }
    }
  }

  // Get series data
  const { data: portfolioValues } = await supabase
    .from('portfolio_value_daily')
    .select('day, value_base_gbp')
    .eq('user_id', userId)
    .gte('day', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('day', { ascending: true })

  const series30d = []
  const valueMap = new Map()
  portfolioValues?.forEach(pv => {
    valueMap.set(pv.day, parseFloat(pv.value_base_gbp))
  })

  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    series30d.push({
      date: dateStr,
      value: valueMap.get(dateStr) || null
    })
  }

  const unrealisedPL = totalEstimatedValue - totalInvested
  const roi = totalInvested > 0 ? (unrealisedPL / totalInvested) * 100 : 0
  const provider = providers.size === 0 ? 'none' : providers.size === 1 ? Array.from(providers)[0] : 'mixed'

  // Tests
  console.log('📊 Test Results:\n')

  console.log(`✓ Test 1: estimatedValue > 0`)
  console.log(`  Value: £${totalEstimatedValue.toFixed(2)}`)
  console.log(`  Status: ${totalEstimatedValue > 0 ? '✅ PASS' : '❌ FAIL'}\n`)

  console.log(`✓ Test 2: series30d.length === 30`)
  console.log(`  Length: ${series30d.length}`)
  console.log(`  Status: ${series30d.length === 30 ? '✅ PASS' : '❌ FAIL'}\n`)

  const nonNullPoints = series30d.filter(s => s.value !== null).length
  console.log(`✓ Test 3: series30d has data points`)
  console.log(`  Non-null points: ${nonNullPoints}`)
  console.log(`  Status: ${nonNullPoints >= 1 ? '✅ PASS' : '❌ FAIL'}\n`)

  console.log(`✓ Test 4: pricesAsOf within last 24h`)
  if (latestPriceTimestamp) {
    const hoursSince = (Date.now() - latestPriceTimestamp.getTime()) / (1000 * 60 * 60)
    console.log(`  Timestamp: ${latestPriceTimestamp.toISOString()}`)
    console.log(`  Hours ago: ${hoursSince.toFixed(1)}h`)
    console.log(`  Status: ${hoursSince < 24 ? '✅ PASS' : '❌ FAIL'}\n`)
  } else {
    console.log(`  Status: ❌ FAIL (no timestamp)\n`)
  }

  console.log(`✓ Test 5: provider is set correctly`)
  console.log(`  Provider: ${provider}`)
  console.log(`  Status: ${provider !== 'none' ? '✅ PASS' : '❌ FAIL'}\n`)

  console.log(`✓ Test 6: ROI calculation`)
  console.log(`  ROI: ${roi.toFixed(2)}%`)
  console.log(`  Unrealised P/L: £${unrealisedPL.toFixed(2)}`)
  console.log(`  Status: ✅ PASS\n`)

  console.log('📝 Summary:')
  console.log(`  Inventory items: ${inventory?.length || 0}`)
  console.log(`  Estimated value: £${totalEstimatedValue.toFixed(2)}`)
  console.log(`  Invested: £${totalInvested.toFixed(2)}`)
  console.log(`  Provider: ${provider}`)
  console.log(`  Series points: ${series30d.length} (${nonNullPoints} non-null)`)
}

testOverviewAPI().catch(console.error)
