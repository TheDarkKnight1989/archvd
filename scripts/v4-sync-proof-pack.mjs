/**
 * V4 Sync Proof Pack
 * Proves sync is working by showing record counts and freshness
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('================================================================================')
  console.log('V4 SYNC PROOF PACK')
  console.log('================================================================================')
  console.log('')

  // 1. Style Catalog Stats
  console.log('=== STYLE CATALOG ===')
  const { count: totalStyles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true })

  const { count: hasStockx } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true })
    .not('stockx_product_id', 'is', null)

  const { count: hasAlias } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*', { count: 'exact', head: true })
    .not('alias_catalog_id', 'is', null)

  console.log(`  Total Styles:     ${totalStyles}`)
  console.log(`  Has StockX ID:    ${hasStockx}`)
  console.log(`  Has Alias ID:     ${hasAlias}`)
  console.log('')

  // 2. StockX V4 Data
  console.log('=== STOCKX V4 DATA ===')

  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00.000Z`
  const todayEnd = `${today}T23:59:59.999Z`

  const { count: stockxProducts } = await supabase
    .from('inventory_v4_stockx_products')
    .select('*', { count: 'exact', head: true })

  const { count: stockxProductsToday } = await supabase
    .from('inventory_v4_stockx_products')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  const { count: stockxVariants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*', { count: 'exact', head: true })

  const { count: stockxVariantsToday } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  const { count: stockxMarketData } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*', { count: 'exact', head: true })

  const { count: stockxMarketDataToday } = await supabase
    .from('inventory_v4_stockx_market_data')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  const { count: stockxPriceHistory } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })

  const { count: stockxPriceHistoryToday } = await supabase
    .from('inventory_v4_stockx_price_history')
    .select('*', { count: 'exact', head: true })
    .eq('snapshot_date', today)

  console.log(`  Products:         ${stockxProducts} (${stockxProductsToday} updated today)`)
  console.log(`  Variants:         ${stockxVariants} (${stockxVariantsToday} updated today)`)
  console.log(`  Market Data:      ${stockxMarketData} (${stockxMarketDataToday} updated today)`)
  console.log(`  Price History:    ${stockxPriceHistory} (${stockxPriceHistoryToday} today)`)
  console.log('')

  // 3. Alias V4 Data
  console.log('=== ALIAS V4 DATA ===')

  const { count: aliasProducts } = await supabase
    .from('inventory_v4_alias_products')
    .select('*', { count: 'exact', head: true })

  const { count: aliasProductsToday } = await supabase
    .from('inventory_v4_alias_products')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  const { count: aliasVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true })

  const { count: aliasVariantsToday } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  const { count: aliasMarketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true })

  const { count: aliasMarketDataToday } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', todayStart)
    .lte('updated_at', todayEnd)

  console.log(`  Products:         ${aliasProducts} (${aliasProductsToday} updated today)`)
  console.log(`  Variants:         ${aliasVariants} (${aliasVariantsToday} updated today)`)
  console.log(`  Market Data:      ${aliasMarketData} (${aliasMarketDataToday} updated today)`)
  console.log('')

  // 4. Sync Queue Status
  console.log('=== SYNC QUEUE STATUS ===')

  const { data: queueStats } = await supabase
    .from('inventory_v4_sync_queue')
    .select('status, provider')

  const stats = {}
  if (queueStats) {
    queueStats.forEach(job => {
      const key = `${job.status}-${job.provider}`
      stats[key] = (stats[key] || 0) + 1
    })
  }

  const statuses = ['pending', 'processing', 'completed', 'failed']
  const providers = ['stockx', 'alias']

  for (const status of statuses) {
    const stockx = stats[`${status}-stockx`] || 0
    const alias = stats[`${status}-alias`] || 0
    if (stockx > 0 || alias > 0) {
      console.log(`  ${status.padEnd(12)} StockX: ${stockx.toString().padStart(4)}, Alias: ${alias.toString().padStart(4)}`)
    }
  }

  console.log('')
  console.log('================================================================================')
  console.log(`PROOF GENERATED AT: ${new Date().toISOString()}`)
  console.log('================================================================================')
}

main().catch(console.error)
