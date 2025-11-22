/**
 * Check market data for the 3 specific items
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ITEM_IDS = [
  '3c386636-f732-401e-9d78-201f36a217f2',
  'b732c556-687e-431f-9173-e9bfe0f02c8b',
  'bb656212-4ee2-4e74-961a-94a33d56aeda',
]

async function checkItems() {
  console.log('📊 Checking Market Data for 3 Specific Items\n')

  for (const itemId of ITEM_IDS) {
    // Get item details
    const { data: item } = await supabase
      .from('Inventory')
      .select('brand, model, sku')
      .eq('id', itemId)
      .single()

    // Get mapping
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', itemId)
      .single()

    console.log(`\n${item.brand} ${item.model} (${item.sku})`)
    console.log(`Item ID: ${itemId}`)
    console.log(`Product: ${mapping.stockx_product_id}`)
    console.log(`Variant: ${mapping.stockx_variant_id}`)

    // Check for snapshots in ANY currency
    const { data: snapshots } = await supabase
      .from('stockx_market_snapshots')
      .select('currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)
      .order('snapshot_at', { ascending: false })
      .limit(3)

    if (snapshots && snapshots.length > 0) {
      console.log(`✅ Found ${snapshots.length} snapshots:`)
      snapshots.forEach(s => {
        console.log(`   ${s.currency_code}: Ask ${s.lowest_ask || 'N/A'}, Bid ${s.highest_bid || 'N/A'} (${s.snapshot_at})`)
      })
    } else {
      console.log(`❌ NO SNAPSHOTS found for this product/variant`)
    }

    // Check stockx_market_latest
    const { data: latest } = await supabase
      .from('stockx_market_latest')
      .select('currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)

    if (latest && latest.length > 0) {
      console.log(`✅ Found in stockx_market_latest (${latest.length} currencies):`)
      latest.forEach(l => {
        console.log(`   ${l.currency_code}: Ask ${l.lowest_ask || 'N/A'}, Bid ${l.highest_bid || 'N/A'}`)
      })
    } else {
      console.log(`❌ NOT in stockx_market_latest view`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log('\nThese 3 items are MAPPED to StockX but have NO market snapshot data.')
  console.log('This means the StockX API sync has never run for these specific')
  console.log('product/variant combinations, OR the products are delisted on StockX.')
  console.log('\nTo populate market data, you need to:')
  console.log('1. Use the authenticated /api/stockx/sync/item endpoint from the browser')
  console.log('2. OR run a worker that has StockX API credentials')
  console.log('3. OR these products may not be available on StockX')
}

checkItems().catch(console.error)
