#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

// Use ANON KEY like the client does (subject to RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('\n🔍 Testing client-side query to stockx_market_latest...\n')

// Query like useInventoryV3 does
const { data, error } = await supabase
  .from('stockx_market_latest')
  .select('stockx_product_id, stockx_variant_id, currency_code, last_sale_price, lowest_ask, highest_bid, snapshot_at')

console.log('Query result:', {
  count: data?.length || 0,
  error: error,
  sample: data?.[0]
})

if (error) {
  console.error('\n❌ ERROR:', error.message)
  console.error('Code:', error.code)
  console.error('Details:', error.details)
  console.error('Hint:', error.hint)
} else {
  console.log(`\n✅ Successfully fetched ${data?.length || 0} rows from stockx_market_latest`)
}
