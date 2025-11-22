#!/usr/bin/env node
/**
 * Check if stockx_market_latest is a view or materialized view
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkViewType() {
  console.log('🔍 Checking stockx_market_latest type...\n')

  // Query PostgreSQL system catalog to check view type
  const { data, error } = await supabase.rpc('exec_raw_sql', {
    sql: `
      SELECT
        relname as name,
        CASE relkind
          WHEN 'r' THEN 'table'
          WHEN 'v' THEN 'view'
          WHEN 'm' THEN 'materialized view'
          WHEN 'i' THEN 'index'
        END as type
      FROM pg_class
      WHERE relname = 'stockx_market_latest'
    `
  })

  if (error) {
    console.log('❌ RPC not available, trying direct query...\n')

    // Try alternative approach
    const queryResult = await supabase.from('pg_class').select('relname, relkind').eq('relname', 'stockx_market_latest')

    if (queryResult.error) {
      console.log('Cannot query pg_class. Please run this SQL in Supabase SQL Editor:')
      console.log(`
SELECT
  relname as name,
  CASE relkind
    WHEN 'r' THEN 'table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'i' THEN 'index'
  END as type
FROM pg_class
WHERE relname = 'stockx_market_latest';
      `)
      console.log('\nAnd also check for the index:')
      console.log(`
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'stockx_market_latest';
      `)
      return
    }
  }

  console.log('Result:', data || 'No data')
}

checkViewType()
