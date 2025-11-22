/**
 * Find inventory items that have StockX mappings
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

  // Get items that have mappings
  const { data: mappings, error } = await supabase
    .from('inventory_market_links')
    .select(`
      item_id,
      stockx_product_id,
      stockx_variant_id,
      Inventory (
        sku,
        size,
        brand,
        model
      )
    `)
    .not('stockx_product_id', 'is', null)
    .not('stockx_variant_id', 'is', null)
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!mappings || mappings.length === 0) {
    console.log('❌ No items with StockX mappings found')
    console.log('\nYou need to create StockX mappings first.')
    console.log('Try using the "Map to StockX" button in your inventory UI.')
    return
  }

  console.log(`✅ Found ${mappings.length} items with StockX mappings:\n`)
  console.log('=' .repeat(80))

  mappings.forEach((mapping, idx) => {
    const item = mapping.Inventory
    console.log(`\n${idx + 1}. ${item.brand} ${item.model}`)
    console.log(`   SKU: ${item.sku}${item.size ? ` | Size: ${item.size}` : ''}`)
    console.log(`   Inventory ID: ${mapping.item_id}`)
    console.log(`   StockX Product: ${mapping.stockx_product_id}`)
    console.log(`   StockX Variant: ${mapping.stockx_variant_id}`)
  })

  console.log('\n' + '=' .repeat(80))
  console.log('\nCopy one of these Inventory IDs and use it in the browser console:')
  console.log('\n```javascript')
  console.log(`fetch('/api/stockx/sync/item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inventoryItemId: 'PASTE_ONE_OF_THE_IDS_ABOVE'
  })
}).then(r => r.json()).then(console.log)`)
  console.log('```\n')
}

findMappedItems()
