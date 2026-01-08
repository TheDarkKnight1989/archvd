#!/usr/bin/env npx tsx
/**
 * Check FULL sync results (last 2 hours to capture complete sync)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔍 Checking FULL Sync Results (last 2 hours)\n')

  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('master_market_data')
    .select('sku, snapshot_at, provider')
    .eq('provider', 'stockx')
    .gte('snapshot_at', twoHoursAgo)
    .order('snapshot_at', { ascending: false })

  if (!data || data.length === 0) {
    console.log('❌ No data found')
    return
  }

  const uniqueSkus = new Set(data.map(s => s.sku))

  console.log('📊 StockX Sync Results:')
  console.log(`  Unique SKUs: ${uniqueSkus.size}/112`)
  console.log(`  Total snapshots: ${data.length}`)
  console.log(`  Oldest: ${data[data.length - 1].snapshot_at}`)
  console.log(`  Newest: ${data[0].snapshot_at}`)

  console.log(`\n📈 Success Rate: ${((uniqueSkus.size / 112) * 100).toFixed(1)}%`)

  if (uniqueSkus.size === 112) {
    console.log('\n✅ ALL 112 PRODUCTS SYNCED!')
  } else {
    console.log(`\n❌ Missing ${112 - uniqueSkus.size} products`)
  }
}

main().catch(console.error)
