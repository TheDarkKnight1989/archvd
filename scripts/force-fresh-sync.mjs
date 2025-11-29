#!/usr/bin/env node

/**
 * Force Fresh Market Data Sync
 *
 * Deletes all StockX market snapshots and syncs fresh data from API
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🔄 Force Fresh Market Data Sync\n')
console.log('=' .repeat(80))

async function main() {
  // Step 1: Delete all market snapshots
  console.log('\n📊 Step 1: Deleting all market snapshots...\n')

  const { error: deleteError } = await supabase
    .from('stockx_market_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (deleteError) {
    console.error('❌ Error deleting snapshots:', deleteError)
    process.exit(1)
  }

  console.log('✅ All market snapshots deleted')

  // Step 2: Refresh materialized view
  console.log('\n📊 Step 2: Refreshing materialized view...\n')

  const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

  if (refreshError) {
    console.error('❌ Error refreshing view:', refreshError)
  } else {
    console.log('✅ Materialized view refreshed')
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Database cleared! Now run the sync button in your UI to fetch fresh data.')
  console.log('\nOR run: POST /api/stockx/sync/inventory')
}

main().catch(console.error)
