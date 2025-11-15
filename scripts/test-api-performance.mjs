/**
 * API Performance Test
 * Measures /api/portfolio/overview response time
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

async function testPerformance() {
  console.log('⏱️  Testing API Performance\n')

  const runs = 5
  const times = []

  for (let i = 1; i <= runs; i++) {
    const start = Date.now()

    // Simulate the overview API logic
    const { data: inventory } = await supabase
      .from('Inventory')
      .select('id, sku, size, size_uk, purchase_price, tax, shipping, purchase_total, category')
      .eq('user_id', userId)
      .eq('status', 'active')

    const { data: marketLinks } = await supabase
      .from('inventory_market_links')
      .select('inventory_id, provider_product_sku')
      .in('inventory_id', inventory?.map(i => i.id) || [])

    // Get prices
    for (const item of inventory || []) {
      const marketSku = marketLinks?.find(l => l.inventory_id === item.id)?.provider_product_sku
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

      await qb.limit(1).single()
    }

    // Get series
    await supabase
      .from('portfolio_value_daily')
      .select('day, value_base_gbp')
      .eq('user_id', userId)
      .gte('day', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('day', { ascending: true })

    const duration = Date.now() - start
    times.push(duration)

    console.log(`Run ${i}: ${duration}ms`)
  }

  times.sort((a, b) => a - b)

  console.log('\n📊 Performance Summary:')
  console.log(`  Min: ${times[0]}ms`)
  console.log(`  Max: ${times[times.length - 1]}ms`)
  console.log(`  Median (P50): ${times[Math.floor(times.length / 2)]}ms`)
  console.log(`  Mean: ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`)

  const p50 = times[Math.floor(times.length / 2)]

  if (p50 < 500) {
    console.log(`\n✅ Performance: EXCELLENT (${p50}ms)`)
  } else if (p50 < 1000) {
    console.log(`\n✅ Performance: GOOD (${p50}ms)`)
  } else if (p50 < 2000) {
    console.log(`\n⚠️  Performance: ACCEPTABLE (${p50}ms)`)
  } else {
    console.log(`\n❌ Performance: SLOW (${p50}ms)`)
  }

  return p50
}

testPerformance().catch(console.error)
