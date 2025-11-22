#!/usr/bin/env node
/**
 * Refresh stockx_market_latest materialized view
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🔄 Refreshing stockx_market_latest materialized view...\n')

try {
  const { error } = await supabase.rpc('refresh_stockx_market_latest')

  if (error) {
    throw new Error(`Failed to refresh view: ${error.message}`)
  }

  console.log('✅ View refreshed successfully!\n')

  // Query to verify data
  const { data: count, error: countError } = await supabase
    .from('stockx_market_latest')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.warn('⚠️  Could not verify row count:', countError.message)
  } else {
    console.log(`   Rows in view: ${count}`)
  }

  // Sample some data
  const { data: sample, error: sampleError } = await supabase
    .from('stockx_market_latest')
    .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid')
    .limit(5)

  if (sampleError) {
    console.warn('⚠️  Could not fetch sample data:', sampleError.message)
  } else {
    console.log('\n   Sample data:')
    sample.forEach(row => {
      console.log(`   - Product: ${row.stockx_product_id.slice(0, 8)}... | Variant: ${row.stockx_variant_id.slice(0, 8)}... | ${row.currency_code} | Ask: £${row.lowest_ask} | Bid: £${row.highest_bid}`)
    })
  }

  console.log('\n✅ DONE!\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
