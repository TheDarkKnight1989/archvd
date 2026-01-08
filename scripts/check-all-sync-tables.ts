#!/usr/bin/env npx tsx
/**
 * Check ALL sync tables to find where data went
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔍 Checking All Sync Tables\n')

  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // Check master_market_data
  const { data: masterData } = await supabase
    .from('master_market_data')
    .select('sku, provider')
    .gte('snapshot_at', fifteenMinsAgo)

  const masterSkus = new Set(masterData?.filter(s => s.provider === 'stockx').map(s => s.sku))
  console.log('📊 master_market_data:')
  console.log(`  StockX SKUs: ${masterSkus.size}`)
  console.log(`  Total rows: ${masterData?.filter(s => s.provider === 'stockx').length || 0}`)

  // Check stockx_market_snapshots (raw)
  const { data: rawSnapshots } = await supabase
    .from('stockx_market_snapshots')
    .select('sku')
    .gte('snapshot_at', fifteenMinsAgo)

  const rawSkus = new Set(rawSnapshots?.map(s => s.sku))
  console.log('\n📊 stockx_market_snapshots (raw):')
  console.log(`  Unique SKUs: ${rawSkus.size}`)
  console.log(`  Total rows: ${rawSnapshots?.length || 0}`)

  // Check stockx_raw_snapshots (newest table)
  const { data: rawRawSnapshots, error: rawRawError } = await supabase
    .from('stockx_raw_snapshots')
    .select('product_id')
    .gte('snapshot_at', fifteenMinsAgo)

  if (!rawRawError) {
    console.log('\n📊 stockx_raw_snapshots:')
    console.log(`  Unique IDs: ${new Set(rawRawSnapshots?.map(s => s.product_id)).size}`)
    console.log(`  Total rows: ${rawRawSnapshots?.length || 0}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n💡 Analysis:')

  if (rawSkus.size > masterSkus.size) {
    console.log(`❌ PROBLEM: ${rawSkus.size} SKUs in raw snapshots, but only ${masterSkus.size} in master_market_data`)
    console.log(`   Missing ${rawSkus.size - masterSkus.size} SKUs from master table`)
    console.log(`   This suggests the ingestion from stockx_market_snapshots → master_market_data is failing`)
  } else if (rawSkus.size === masterSkus.size) {
    console.log(`✅ Data matches between raw and master tables (${rawSkus.size} SKUs)`)
  } else {
    console.log(`⚠️  More data in master than raw (unusual)`)
  }
}

main().catch(console.error)
