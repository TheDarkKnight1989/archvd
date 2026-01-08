import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

  console.log('=== STOCKX PRICE HISTORY - ROWS PER DAY ===')

  const { count: stockxCount } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })
    .gte('recorded_at', tenDaysAgo)

  console.log('Total rows (last 10 days):', stockxCount)

  // Sample for daily breakdown
  const { data: stockxRecent } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('recorded_at')
    .gte('recorded_at', tenDaysAgo)
    .order('recorded_at', { ascending: false })
    .limit(10000)

  if (stockxRecent) {
    const byDay = {}
    stockxRecent.forEach(r => {
      const day = r.recorded_at.split('T')[0]
      byDay[day] = (byDay[day] || 0) + 1
    })
    Object.entries(byDay).sort((a,b) => b[0].localeCompare(a[0])).forEach(([day, count]) => {
      console.log(`${day}: ${count} rows`)
    })
    console.log(`Total: ${stockxRecent.length} rows in last 10 days`)
  }

  console.log('')
  console.log('=== ALIAS PRICE HISTORY - ROWS PER DAY ===')

  const { count: aliasCount } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('*', { count: 'exact', head: true })
    .gte('recorded_at', tenDaysAgo)

  console.log('Total rows (last 10 days):', aliasCount)

  const { data: aliasRecent } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('recorded_at')
    .gte('recorded_at', tenDaysAgo)
    .order('recorded_at', { ascending: false })
    .limit(10000)

  if (aliasRecent) {
    const byDay = {}
    aliasRecent.forEach(r => {
      const day = r.recorded_at.split('T')[0]
      byDay[day] = (byDay[day] || 0) + 1
    })
    Object.entries(byDay).sort((a,b) => b[0].localeCompare(a[0])).forEach(([day, count]) => {
      console.log(`${day}: ${count} rows`)
    })
    console.log(`Total: ${aliasRecent.length} rows in last 10 days`)
  }

  // Distinct variant counts - use variant tables
  console.log('')
  console.log('=== VARIANT COUNTS ===')

  const { count: stockxVariantCount } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*', { count: 'exact', head: true })

  const { count: aliasVariantCount } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true })

  console.log('StockX variants:', stockxVariantCount)
  console.log('Alias variants:', aliasVariantCount)

  // Total price history rows
  console.log('')
  console.log('=== TOTAL PRICE HISTORY (ALL TIME) ===')

  const { count: totalStockxPH } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })

  const { count: totalAliasPH } = await supabase
    .from('inventory_v4_alias_price_history')
    .select('*', { count: 'exact', head: true })

  console.log('StockX price_history:', totalStockxPH)
  console.log('Alias price_history:', totalAliasPH)
}

main()
