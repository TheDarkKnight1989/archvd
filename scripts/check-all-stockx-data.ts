#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Check total count
  const { count: totalCount } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')

  console.log(`Total StockX records: ${totalCount}`)

  // Check by creation time
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('master_market_data')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'stockx')
    .gte('created_at', oneHourAgo)

  console.log(`Created in last hour: ${recentCount}`)

  // Check unique products
  const { data } = await supabase
    .from('master_market_data')
    .select('provider_product_id, sku')
    .eq('provider', 'stockx')

  const uniqueProducts = new Set(data?.map(r => r.provider_product_id))
  const uniqueSkus = [...new Set(data?.map(r => r.sku))].sort()

  console.log(`\nUnique products: ${uniqueProducts.size}`)
  console.log(`\nAll SKUs in database:`)
  uniqueSkus.forEach((sku, idx) => console.log(`  ${idx + 1}. ${sku}`))
}

check()
