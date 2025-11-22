#!/usr/bin/env node
/**
 * Find inventory items with StockX mappings but no market snapshots
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function findMissing() {
  console.log('🔍 Finding items with mappings but no snapshots...\n')

  // Get all mappings
  const { data: links } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id')
    .not('stockx_product_id', 'is', null)
    .not('stockx_variant_id', 'is', null)

  console.log(`Found ${links.length} items with StockX mappings\n`)

  const missing = []

  for (const link of links) {
    // Check if snapshot exists
    const { data: snapshot, count } = await supabase
      .from('stockx_market_snapshots')
      .select('*', { count: 'exact', head: false })
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)
      .limit(1)

    if (count === 0) {
      // Get item details
      const { data: item } = await supabase
        .from('Inventory')
        .select('id, sku, size, brand, model')
        .eq('id', link.item_id)
        .single()

      missing.push({
        ...item,
        stockx_product_id: link.stockx_product_id,
        stockx_variant_id: link.stockx_variant_id,
      })
    }
  }

  console.log(`\n❌ Found ${missing.length} items missing snapshots:\n`)
  console.log('=' .repeat(70))

  for (const item of missing) {
    console.log(`\nItem: ${item.brand} ${item.model}`)
    console.log(`  SKU: ${item.sku}`)
    console.log(`  Size: ${item.size}`)
    console.log(`  Item ID: ${item.id}`)
    console.log(`  StockX Product: ${item.stockx_product_id}`)
    console.log(`  StockX Variant: ${item.stockx_variant_id}`)
  }

  if (missing.length > 0) {
    console.log('\n' + '=' .repeat(70))
    console.log('\nTo sync these items, run in browser console:')
    console.log('\nfor (const id of [')
    missing.forEach((item, i) => {
      const comma = i < missing.length - 1 ? ',' : ''
      console.log(`  '${item.id}'${comma}`)
    })
    console.log(']) {')
    console.log(`  await fetch('/api/stockx/sync/item', {`)
    console.log(`    method: 'POST',`)
    console.log(`    headers: { 'Content-Type': 'application/json' },`)
    console.log(`    body: JSON.stringify({ inventoryItemId: id })`)
    console.log(`  }).then(r => r.json()).then(console.log)`)
    console.log('}')
  }
}

findMissing()
