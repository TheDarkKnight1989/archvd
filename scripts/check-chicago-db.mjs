#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const productId = '83c11c36-1e00-4831-85e5-6067abf2f18b'
const variantIds = [
  { id: '5c9c0e3c-0c64-4540-94ac-2c2dbdf87754', size: 'UK 9' },
  { id: '48af2a2e-4e1b-4b69-bd65-c9d85a106385', size: 'UK 11' }
]

console.log('\n📊 Checking stockx_market_snapshots for Chicago Low items:\n')

for (const variant of variantIds) {
  const { data, error } = await supabase
    .from('stockx_market_snapshots')
    .select('*')
    .eq('stockx_product_id', productId)
    .eq('stockx_variant_id', variant.id)
    .eq('currency_code', 'GBP')
    .order('snapshot_at', { ascending: false })
    .limit(1)

  console.log(`Chicago Low ${variant.size}:`)
  if (error) {
    console.log('  Error:', error.message)
  } else if (!data || data.length === 0) {
    console.log('  ❌ No snapshots found in database')
  } else {
    console.log('  ✅ Found snapshot:')
    console.log(`     lowest_ask: £${data[0].lowest_ask}`)
    console.log(`     highest_bid: £${data[0].highest_bid}`)
    console.log(`     snapshot_at: ${data[0].snapshot_at}`)
  }
  console.log()
}

// Also check stockx_market_latest
console.log('📊 Checking stockx_market_latest view:\n')

for (const variant of variantIds) {
  const { data, error } = await supabase
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', productId)
    .eq('stockx_variant_id', variant.id)
    .eq('currency_code', 'GBP')
    .single()

  console.log(`Chicago Low ${variant.size}:`)
  if (error) {
    console.log('  Error:', error.message)
  } else if (!data) {
    console.log('  ❌ No row found in stockx_market_latest view')
  } else {
    console.log('  ✅ Found in view:')
    console.log(`     lowest_ask: £${data.lowest_ask}`)
    console.log(`     highest_bid: £${data.highest_bid}`)
    console.log(`     snapshot_at: ${data.snapshot_at}`)
  }
  console.log()
}
