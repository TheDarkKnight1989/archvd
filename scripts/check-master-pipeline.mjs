#!/usr/bin/env node

/**
 * Check if the master_market_data pipeline is working
 * Flow: StockX API → stockx_raw_snapshots → master_market_data → master_market_latest
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPipeline() {
  console.log('\n🔍 MASTER MARKET DATA PIPELINE CHECK')
  console.log('='.repeat(80))

  // 1. Check stockx_raw_snapshots (source)
  console.log('\n1️⃣  STOCKX_RAW_SNAPSHOTS (source):')
  console.log('─'.repeat(80))

  const { data: rawSnapshots, error: rawErr } = await supabase
    .from('stockx_raw_snapshots')
    .select('id, snapshot_type, stockx_product_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (rawErr) {
    console.error('❌ Error:', rawErr.message)
  } else if (!rawSnapshots || rawSnapshots.length === 0) {
    console.log('❌ NO RAW SNAPSHOTS - pipeline not running!')
  } else {
    console.log(`✅ Found ${rawSnapshots.length} recent snapshots`)
    const latest = rawSnapshots[0]
    console.log('   Latest:', {
      id: latest.id,
      type: latest.snapshot_type,
      product_id: latest.stockx_product_id,
      created_at: latest.created_at,
    })
  }

  // 2. Check master_market_data (target)
  console.log('\n2️⃣  MASTER_MARKET_DATA (target):')
  console.log('─'.repeat(80))

  const { data: masterData, error: masterErr } = await supabase
    .from('master_market_data')
    .select('id, provider, provider_product_id, sku, lowest_ask, snapshot_at, raw_snapshot_id')
    .eq('provider', 'stockx')
    .order('snapshot_at', { ascending: false })
    .limit(5)

  if (masterErr) {
    console.error('❌ Error:', masterErr.message)
  } else if (!masterData || masterData.length === 0) {
    console.log('❌ NO MASTER DATA - ingestion not working!')
  } else {
    console.log(`✅ Found ${masterData.length} recent master records`)
    const latest = masterData[0]
    console.log('   Latest:', {
      id: latest.id,
      provider: latest.provider,
      product_id: latest.provider_product_id,
      sku: latest.sku,
      lowest_ask: latest.lowest_ask,
      snapshot_at: latest.snapshot_at,
      has_raw_link: !!latest.raw_snapshot_id,
    })
  }

  // 3. Check if raw snapshots are linked to master data
  console.log('\n3️⃣  LINKAGE CHECK:')
  console.log('─'.repeat(80))

  if (rawSnapshots && rawSnapshots.length > 0 && masterData && masterData.length > 0) {
    const latestRawId = rawSnapshots[0].id

    const { data: linkedMaster, error: linkErr } = await supabase
      .from('master_market_data')
      .select('id, snapshot_at')
      .eq('raw_snapshot_id', latestRawId)

    if (linkErr) {
      console.error('❌ Error checking linkage:', linkErr.message)
    } else if (!linkedMaster || linkedMaster.length === 0) {
      console.log('❌ NO LINKAGE - raw snapshot not ingested to master!')
      console.log(`   Raw snapshot ${latestRawId} has no corresponding master_market_data rows`)
    } else {
      console.log(`✅ LINKED - raw snapshot has ${linkedMaster.length} master_market_data rows`)
    }
  }

  // 4. Check master_market_latest view
  console.log('\n4️⃣  MASTER_MARKET_LATEST (materialized view):')
  console.log('─'.repeat(80))

  const { data: latestView, error: viewErr } = await supabase
    .from('master_market_latest')
    .select('provider, provider_product_id, sku, lowest_ask, snapshot_at')
    .eq('provider', 'stockx')
    .order('snapshot_at', { ascending: false })
    .limit(5)

  if (viewErr) {
    console.error('❌ Error:', viewErr.message)
  } else if (!latestView || latestView.length === 0) {
    console.log('❌ NO DATA IN VIEW - view needs refresh or no data ingested!')
  } else {
    console.log(`✅ Found ${latestView.length} records in view`)
    const latest = latestView[0]
    console.log('   Latest:', {
      provider: latest.provider,
      product_id: latest.provider_product_id,
      sku: latest.sku,
      lowest_ask: latest.lowest_ask,
      snapshot_at: latest.snapshot_at,
    })
  }

  // 5. Time comparison
  console.log('\n5️⃣  FRESHNESS CHECK:')
  console.log('─'.repeat(80))

  if (rawSnapshots && rawSnapshots.length > 0) {
    const rawTime = new Date(rawSnapshots[0].created_at)
    const now = new Date()
    const ageMinutes = Math.floor((now - rawTime) / 1000 / 60)

    console.log(`   Latest raw snapshot: ${ageMinutes} minutes old`)

    if (ageMinutes < 30) {
      console.log('   ✅ FRESH - data is recent')
    } else if (ageMinutes < 120) {
      console.log('   ⚠️  STALE - data is old but acceptable')
    } else {
      console.log('   ❌ VERY STALE - pipeline may be broken')
    }
  }

  if (masterData && masterData.length > 0) {
    const masterTime = new Date(masterData[0].snapshot_at)
    const now = new Date()
    const ageMinutes = Math.floor((now - masterTime) / 1000 / 60)

    console.log(`   Latest master data: ${ageMinutes} minutes old`)
  }

  // SUMMARY
  console.log('\n' + '='.repeat(80))
  console.log('PIPELINE STATUS:')

  const hasRawData = rawSnapshots && rawSnapshots.length > 0
  const hasMasterData = masterData && masterData.length > 0
  const hasViewData = latestView && latestView.length > 0

  if (hasRawData && hasMasterData && hasViewData) {
    console.log('✅ PIPELINE WORKING - all stages have data')
  } else if (hasRawData && !hasMasterData) {
    console.log('❌ INGESTION BROKEN - raw data exists but not flowing to master_market_data')
  } else if (!hasRawData) {
    console.log('❌ SOURCE BROKEN - no raw snapshots being created')
  } else if (hasMasterData && !hasViewData) {
    console.log('⚠️  VIEW STALE - master data exists but materialized view needs refresh')
  }

  console.log('='.repeat(80) + '\n')
}

checkPipeline().catch(console.error)
