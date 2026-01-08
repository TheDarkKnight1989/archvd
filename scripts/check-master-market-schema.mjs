#!/usr/bin/env node

/**
 * Check master_market_data table schema and migration status
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('MASTER MARKET DATA SCHEMA CHECK')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')

  // Check if table exists
  const { data: tableExists, error: tableError } = await supabase
    .from('master_market_data')
    .select('id')
    .limit(1)

  if (tableError) {
    if (tableError.code === '42P01') {
      console.log('❌ master_market_data table DOES NOT EXIST')
      console.log('   You MUST apply: 20251203_create_master_market_data.sql\n')
      process.exit(1)
    }
    console.error('❌ Error checking table:', tableError)
    process.exit(1)
  }

  console.log('✅ master_market_data table EXISTS\n')

  // Check for flex/consigned columns
  console.log('Checking schema columns...')
  const { data: sampleRow } = await supabase
    .from('master_market_data')
    .select('*')
    .limit(1)
    .single()

  const columns = sampleRow ? Object.keys(sampleRow) : []

  const hasIsFlexColumn = columns.includes('is_flex')
  const hasIsConsignedColumn = columns.includes('is_consigned')
  const hasFlexEligibleColumn = columns.includes('flex_eligible')
  const hasConsignmentFeePctColumn = columns.includes('consignment_fee_pct')

  console.log(`  is_flex: ${hasIsFlexColumn ? '✅' : '❌'}`)
  console.log(`  is_consigned: ${hasIsConsignedColumn ? '✅' : '❌'}`)
  console.log(`  flex_eligible: ${hasFlexEligibleColumn ? '✅' : '❌'}`)
  console.log(`  consignment_fee_pct: ${hasConsignmentFeePctColumn ? '✅' : '❌'}`)
  console.log()

  // Check for indexes using raw SQL
  console.log('Checking indexes...')
  const { data: indexData, error: indexError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'master_market_data'
    `
  }).catch(async () => {
    // Fallback: try direct table query
    return { data: null, error: null }
  })

  if (indexData) {
    const uniqueSnapshotIndex = indexData.find(idx =>
      idx.indexname === 'idx_master_market_unique_snapshot'
    )

    if (uniqueSnapshotIndex) {
      console.log('  ✅ idx_master_market_unique_snapshot EXISTS')
      console.log(`     Definition: ${uniqueSnapshotIndex.indexdef.substring(0, 100)}...`)

      // Check if index includes is_flex and is_consigned
      const hasFlexInIndex = uniqueSnapshotIndex.indexdef.includes('is_flex')
      const hasConsignedInIndex = uniqueSnapshotIndex.indexdef.includes('is_consigned')

      console.log(`     Includes is_flex: ${hasFlexInIndex ? '✅' : '❌'}`)
      console.log(`     Includes is_consigned: ${hasConsignedInIndex ? '✅' : '❌'}`)
      console.log()

      if (hasFlexInIndex && hasConsignedInIndex) {
        console.log('═══════════════════════════════════════════════════════════════════════════')
        console.log('CONCLUSION')
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
        console.log('✅ Your schema is ALREADY UP TO DATE')
        console.log('   The flex/consigned migration was already applied.')
        console.log()
        console.log('⚠️  DO NOT apply 20251203_create_master_market_data.sql')
        console.log('   This would try to create an older version of the index.')
        console.log()
        console.log('✅ SKIP to the next migration:')
        console.log('   - 20251203_create_raw_snapshot_tables.sql (if not applied)')
        console.log()
      } else {
        console.log('═══════════════════════════════════════════════════════════════════════════')
        console.log('CONCLUSION')
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
        console.log('⚠️  Index exists but does NOT include flex/consigned columns')
        console.log('   You need to apply: 20251203_add_flex_consigned_support.sql')
        console.log()
      }
    } else {
      console.log('  ❌ idx_master_market_unique_snapshot DOES NOT EXIST')
      console.log()
      console.log('═══════════════════════════════════════════════════════════════════════════')
      console.log('CONCLUSION')
      console.log('═══════════════════════════════════════════════════════════════════════════\n')
      console.log('⚠️  Table exists but index is missing')
      console.log('   Apply migrations in this order:')
      console.log('   1. Create the base index (modify create_master_market_data.sql to use IF NOT EXISTS)')
      console.log('   2. Then apply 20251203_add_flex_consigned_support.sql')
      console.log()
    }
  } else {
    console.log('  ⚠️  Could not query pg_indexes (permission issue)')
    console.log()
  }

  // Check materialized view
  console.log('Checking materialized view...')
  const { data: mvExists } = await supabase
    .from('master_market_latest')
    .select('id')
    .limit(1)
    .catch(() => ({ data: null }))

  if (mvExists !== null) {
    console.log('  ✅ master_market_latest materialized view EXISTS')
  } else {
    console.log('  ❌ master_market_latest materialized view DOES NOT EXIST')
  }
  console.log()
}

main().catch(console.error)
