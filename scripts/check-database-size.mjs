#!/usr/bin/env node
/**
 * Check current database size and table breakdown
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('📊 DATABASE SIZE AUDIT\n')
  console.log('=' .repeat(80))

  // Get database size (Supabase free tier: 500 MB limit)
  const { data: dbSize, error: dbError } = await supabase.rpc('pg_database_size', {
    database_name: 'postgres'
  }).single()

  if (!dbError && dbSize) {
    const sizeInMB = (dbSize / 1024 / 1024).toFixed(2)
    const percentUsed = ((sizeInMB / 500) * 100).toFixed(1)
    console.log(`\n🗄️  TOTAL DATABASE SIZE: ${sizeInMB} MB / 500 MB (${percentUsed}% used)`)
  }

  // Get table sizes
  console.log('\n📋 TABLE BREAKDOWN\n')
  console.log('-'.repeat(80))

  const { data: tables, error: tablesError } = await supabase.rpc('pg_table_sizes')

  if (tablesError) {
    console.log('Note: Custom function pg_table_sizes not available')
    console.log('Run this query manually in Supabase SQL editor:\n')
    console.log(`
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC
LIMIT 20;
    `)
  } else if (tables) {
    tables.forEach(table => {
      const sizeMB = (table.size_bytes / 1024 / 1024).toFixed(2)
      console.log(`${table.tablename.padEnd(40)} ${sizeMB} MB`)
    })
  }

  // Count rows in key tables
  console.log('\n📊 ROW COUNTS\n')
  console.log('-'.repeat(80))

  const tablesToCheck = [
    'master_market_data',
    'stockx_market_latest',
    'alias_market_snapshots',
    'ebay_sold_transactions',
    'stockx_raw_snapshots',
    'alias_raw_snapshots',
    'Inventory',
    'alias_catalog_items',
    'stockx_products',
  ]

  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (!error) {
      const countStr = (count || 0).toLocaleString()
      console.log(`${table.padEnd(35)} ${countStr.padStart(15)} rows`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n💡 FREE TIER LIMITS:')
  console.log('  Supabase: 500 MB database size')
  console.log('  Vercel: 100 GB bandwidth/month, 100K function invocations/month')
  console.log('\n')
}

main().catch(console.error)
