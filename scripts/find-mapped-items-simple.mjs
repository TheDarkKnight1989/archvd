/**
 * Find inventory items that have StockX mappings - SIMPLE VERSION
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function findMappedItems() {
  console.log('🔍 Finding inventory items with StockX mappings...\n')

  // Step 1: Get mappings
  const { data: mappings, error: mappingsError } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .not('stockx_product_id', 'is', null)
    .not('stockx_variant_id', 'is', null)
    .limit(10)

  if (mappingsError) {
    console.error('Error getting mappings:', mappingsError)
    return
  }

  if (!mappings || mappings.length === 0) {
    console.log('❌ No items with StockX mappings found\n')
    console.log('The Phase 3.5 fix is complete, but you need to map items first.')
    console.log('\nTo map an item:')
    console.log('1. Go to your Portfolio Inventory page')
    console.log('2. Click "Map to StockX" on any item')
    console.log('3. Then come back and run this script again')
    return
  }

  console.log(`✅ Found ${mappings.length} items with StockX mappings\n`)
  console.log('=' .repeat(80))

  // Step 2: Get item details for each mapping
  for (const mapping of mappings) {
    const { data: item } = await supabase
      .from('Inventory')
      .select('sku, size, brand, model')
      .eq('id', mapping.item_id)
      .single()

    if (item) {
      console.log(`\n${item.brand || 'Unknown'} ${item.model || item.sku}`)
      console.log(`   SKU: ${item.sku}${item.size ? ` | Size: ${item.size}` : ''}`)
      console.log(`   Inventory ID: ${mapping.item_id}`)
      console.log(`   ✅ Mapped to StockX`)
    }
  }

  console.log('\n' + '=' .repeat(80))
  console.log('\n📝 To test the Phase 3.5 fix, paste this in your browser console:')
  console.log('\n```javascript')
  console.log(`fetch('/api/stockx/sync/item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inventoryItemId: '${mappings[0].item_id}'
  })
}).then(r => r.json()).then(console.log)`)
  console.log('```\n')
}

findMappedItems()
