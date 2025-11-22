#!/usr/bin/env node
/**
 * Check stockx_market_latest view data
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🔍 Checking stockx_market_latest view...\n')

try {
  // Query to verify data
  const { data: count, error: countError } = await supabase
    .from('stockx_market_latest')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    throw new Error(`Failed to query view: ${countError.message}`)
  }

  console.log(`✅ View exists and has ${count} rows\n`)

  // Sample some data
  const { data: sample, error: sampleError } = await supabase
    .from('stockx_market_latest')
    .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, snapshot_at')
    .eq('currency_code', 'GBP')
    .order('snapshot_at', { ascending: false })
    .limit(10)

  if (sampleError) {
    throw new Error(`Failed to fetch sample: ${sampleError.message}`)
  }

  console.log('   Recent GBP entries:')
  sample.forEach(row => {
    const productShort = row.stockx_product_id.slice(0, 8)
    const variantShort = row.stockx_variant_id.slice(0, 8)
    const timestamp = new Date(row.snapshot_at).toLocaleString()
    console.log(`   - ${productShort}.../${variantShort}... | Ask: £${row.lowest_ask || 'N/A'} | Bid: £${row.highest_bid || 'N/A'} | ${timestamp}`)
  })

  console.log('\n✅ DONE!\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
