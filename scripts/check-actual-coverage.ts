#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkCoverage() {
  // Total records
  const { count: totalRecords } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  // Unique products in master_market_data
  const { data: uniqueProductIds } = await supabase
    .from('master_market_data')
    .select('provider_product_id')
    .eq('provider', 'stockx')

  const uniqueProducts = new Set(uniqueProductIds?.map(r => r.provider_product_id).filter(Boolean))

  // Total products in stockx_products
  const { count: totalStockXProducts } = await supabase
    .from('stockx_products')
    .select('*', { count: 'exact', head: true })

  // Recent snapshots (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentSnapshots } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')
    .gte('created_at', oneHourAgo)

  // Recent unique products (last hour)
  const { data: recentProductIds } = await supabase
    .from('master_market_data')
    .select('provider_product_id')
    .eq('provider', 'stockx')
    .gte('created_at', oneHourAgo)

  const recentUniqueProducts = new Set(recentProductIds?.map(r => r.provider_product_id).filter(Boolean))

  console.log('\n📊 StockX Coverage Analysis\n')
  console.log('─'.repeat(75))
  console.log(`Total StockX records in master_market_data: ${totalRecords?.toLocaleString() || 0}`)
  console.log(`Unique StockX products synced:              ${uniqueProducts.size}`)
  console.log(`Total products in stockx_products:          ${totalStockXProducts || 0}`)
  console.log(`Missing products:                           ${(totalStockXProducts || 0) - uniqueProducts.size}`)
  console.log(`Coverage:                                   ${((uniqueProducts.size / (totalStockXProducts || 1)) * 100).toFixed(1)}%`)
  console.log('─'.repeat(75))
  console.log(`\nRecent Activity (last hour):`)
  console.log(`  New snapshots created:     ${recentSnapshots?.toLocaleString() || 0}`)
  console.log(`  New unique products:       ${recentUniqueProducts.size}`)
  console.log('─'.repeat(75))
}

checkCoverage()
