/**
 * Debug: Check what's in the database
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function debug() {
  console.log('🔍 Debugging Database Structure\n')

  // Check inventory_market_links
  console.log('1. Checking inventory_market_links...')
  const { data: links, error: linksError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .limit(5)

  if (linksError) {
    console.log(`   ❌ Error: ${linksError.message}`)
  } else {
    console.log(`   ✅ Found ${links?.length || 0} rows`)
    if (links && links.length > 0) {
      console.log('   Sample:', JSON.stringify(links[0], null, 2))
    }
  }

  // Check specific items
  console.log('\n2. Checking specific inventory items...')
  const itemIds = [
    '3c386636-f732-401e-9d78-201f36a217f2',
    'b732c556-687e-431f-9173-e9bfe0f02c8b',
    'bb656212-4ee2-4e74-961a-94a33d56aeda',
  ]

  for (const id of itemIds) {
    const { data: item } = await supabase
      .from('Inventory')
      .select('id, brand, model, sku')
      .eq('id', id)
      .single()

    if (item) {
      console.log(`   ✅ ${id}: ${item.brand} ${item.model}`)

      // Check if it has a mapping
      const { data: mapping } = await supabase
        .from('inventory_market_links')
        .select('*')
        .eq('item_id', id)
        .single()

      if (mapping) {
        console.log(`      → Mapped to StockX product: ${mapping.stockx_product_id}`)
      } else {
        console.log(`      ❌ No StockX mapping found`)
      }
    } else {
      console.log(`   ❌ ${id}: Not found in Inventory table`)
    }
  }

  // Check stockx_market_latest view
  console.log('\n3. Checking stockx_market_latest view...')
  const { data: latest, error: latestError } = await supabase
    .from('stockx_market_latest')
    .select('*')
    .limit(5)

  if (latestError) {
    console.log(`   ❌ Error: ${latestError.message}`)
  } else {
    console.log(`   ✅ Found ${latest?.length || 0} rows`)
    if (latest && latest.length > 0) {
      console.log('   Sample:', JSON.stringify(latest[0], null, 2))
    }
  }

  // Check stockx_market_snapshots
  console.log('\n4. Checking stockx_market_snapshots table...')
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('stockx_market_snapshots')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(3)

  if (snapshotsError) {
    console.log(`   ❌ Error: ${snapshotsError.message}`)
  } else {
    console.log(`   ✅ Found ${snapshots?.length || 0} recent snapshots`)
    snapshots?.forEach(s => {
      console.log(`      ${s.stockx_product_id} (${s.currency_code}): Ask £${s.lowest_ask || 'N/A'}, Bid £${s.highest_bid || 'N/A'}`)
    })
  }
}

debug().catch(console.error)
