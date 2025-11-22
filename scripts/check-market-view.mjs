#!/usr/bin/env node
/**
 * Check stockx_market_latest view status
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkView() {
  console.log('🔍 Checking stockx_market_latest view...\n')

  // Check if view has data
  const { data, error, count } = await supabase
    .from('stockx_market_latest')
    .select('*', { count: 'exact', head: false })
    .limit(5)

  if (error) {
    console.error('❌ Error querying view:', error)
    return
  }

  console.log(`✅ View exists and has ${count} total rows`)
  console.log('\nSample data (first 5 rows):')
  console.log(JSON.stringify(data, null, 2))

  // Check snapshots table
  console.log('\n' + '='.repeat(70))
  const { count: snapshotCount } = await supabase
    .from('stockx_market_snapshots')
    .select('*', { count: 'exact', head: true })

  console.log(`\nstockx_market_snapshots has ${snapshotCount} rows`)

  // Try to refresh
  console.log('\n' + '='.repeat(70))
  console.log('Testing refresh function...')
  const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

  if (refreshError) {
    console.error('❌ Refresh failed:', refreshError)
  } else {
    console.log('✅ Refresh successful!')
  }
}

checkView()
