/**
 * V4 24-Hour Health Check
 * Run tomorrow to verify data integrity and growth
 *
 * Usage: source .env.local && node scripts/v4-24h-health-check.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('============================================================')
  console.log('V4 24-HOUR HEALTH CHECK')
  console.log('Run date:', new Date().toISOString())
  console.log('============================================================')
  console.log('')

  // 1. DUPLICATE GROUPS CHECK
  console.log('=== 1. SALES_HISTORY DUPLICATE CHECK ===')
  const { data: allSales } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('alias_catalog_id, size_value, price, purchased_at')

  if (allSales) {
    const seen = new Map()
    let duplicateGroups = 0
    allSales.forEach(s => {
      const key = `${s.alias_catalog_id}|${s.size_value}|${s.price}|${s.purchased_at}`
      const count = (seen.get(key) || 0) + 1
      seen.set(key, count)
      if (count === 2) duplicateGroups++ // Count when it becomes a duplicate
    })
    console.log('Duplicate groups:', duplicateGroups)
    console.log('Expected: 0')
    console.log(duplicateGroups === 0 ? '✅ PASS' : '❌ FAIL')
  }

  // 2. ROW COUNT SNAPSHOT
  console.log('')
  console.log('=== 2. ROW COUNT SNAPSHOT ===')
  console.log('(Compare to previous day to verify growth)')

  const { count: stockxPH } = await supabase.from('inventory_v4_stockx_price_history').select('*', { count: 'exact', head: true })
  const { count: aliasPH } = await supabase.from('inventory_v4_alias_price_history').select('*', { count: 'exact', head: true })
  const { count: aliasSH } = await supabase.from('inventory_v4_alias_sales_history').select('*', { count: 'exact', head: true })
  const { count: stockxProds } = await supabase.from('inventory_v4_stockx_products').select('*', { count: 'exact', head: true })
  const { count: aliasProds } = await supabase.from('inventory_v4_alias_products').select('*', { count: 'exact', head: true })

  console.log('StockX price_history:', stockxPH)
  console.log('Alias price_history:', aliasPH)
  console.log('Alias sales_history:', aliasSH)
  console.log('StockX products:', stockxProds)
  console.log('Alias products:', aliasProds)

  // 3. FRESHNESS (last 24h)
  console.log('')
  console.log('=== 3. FRESHNESS (last 24h) ===')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: stockxRecent24 } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('recorded_at')
    .gte('recorded_at', oneDayAgo)
    .order('recorded_at', { ascending: true })
    .limit(1)

  const { data: stockxMax24 } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('recorded_at')
    .gte('recorded_at', oneDayAgo)
    .order('recorded_at', { ascending: false })
    .limit(1)

  const { count: stockx24Count } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })
    .gte('recorded_at', oneDayAgo)

  console.log('StockX (last 24h):')
  console.log('  Min recorded_at:', stockxRecent24?.[0]?.recorded_at || 'N/A')
  console.log('  Max recorded_at:', stockxMax24?.[0]?.recorded_at || 'N/A')
  console.log('  Rows:', stockx24Count)

  const { data: aliasRecent24 } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('recorded_at')
    .gte('recorded_at', oneDayAgo)
    .order('recorded_at', { ascending: true })
    .limit(1)

  const { data: aliasMax24 } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('recorded_at')
    .gte('recorded_at', oneDayAgo)
    .order('recorded_at', { ascending: false })
    .limit(1)

  const { count: alias24Count } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('*', { count: 'exact', head: true })
    .gte('recorded_at', oneDayAgo)

  console.log('Alias (last 24h):')
  console.log('  Min recorded_at:', aliasRecent24?.[0]?.recorded_at || 'N/A')
  console.log('  Max recorded_at:', aliasMax24?.[0]?.recorded_at || 'N/A')
  console.log('  Rows:', alias24Count)

  // 4. QUEUE HEALTH
  console.log('')
  console.log('=== 4. QUEUE HEALTH ===')

  const { data: queueStats } = await supabase.rpc('queue_stats_v4')
  if (queueStats) {
    queueStats.forEach(s => {
      console.log(`${s.status}: ${s.count}`)
    })
  }

  // 5. FAILED JOBS BY ERROR CATEGORY
  console.log('')
  console.log('=== 5. FAILED JOBS BY ERROR CATEGORY ===')

  const { data: failedJobs } = await supabase
    .from('inventory_v4_sync_queue')
    .select('last_error')
    .eq('status', 'failed')

  if (failedJobs && failedJobs.length > 0) {
    const categories = {}
    failedJobs.forEach(j => {
      const err = j.last_error || 'UNKNOWN'
      let cat = 'OTHER'
      if (err.startsWith('MISSING_MAPPING:')) cat = 'MISSING_MAPPING'
      else if (err.includes('502') || err.includes('503') || err.includes('504')) cat = 'HTTP_5XX'
      else if (err.includes('429')) cat = 'RATE_LIMITED'
      else if (err.toLowerCase().includes('timeout')) cat = 'TIMEOUT'
      categories[cat] = (categories[cat] || 0) + 1
    })
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`${cat}: ${count}`)
    })
  } else {
    console.log('No failed jobs')
  }

  console.log('')
  console.log('============================================================')
  console.log('END OF HEALTH CHECK')
  console.log('============================================================')
}

main()
