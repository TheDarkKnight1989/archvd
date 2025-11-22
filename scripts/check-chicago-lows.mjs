#!/usr/bin/env node
/**
 * Check Chicago Low items for snapshots
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CHICAGO_LOW_IDS = [
  '729d9d3d-b9e2-4f1e-8286-e235624b2923',  // Size 9
  '85a1fbbd-b271-4961-b65b-4d862ec2ac23'   // Size 11
]

async function checkChicagoLows() {
  console.log('🔍 Checking Chicago Low items...\n')

  for (const itemId of CHICAGO_LOW_IDS) {
    console.log('=' .repeat(70))

    // Get item details
    const { data: item } = await supabase
      .from('Inventory')
      .select('*')
      .eq('id', itemId)
      .single()

    console.log(`\nItem: ${item.brand} ${item.model}`)
    console.log(`  SKU: ${item.sku}`)
    console.log(`  Size: ${item.size}`)
    console.log(`  Item ID: ${item.id}`)

    // Get mapping
    const { data: link } = await supabase
      .from('inventory_market_links')
      .select('*')
      .eq('item_id', itemId)
      .single()

    if (!link) {
      console.log('  ❌ No mapping found!')
      continue
    }

    console.log(`\n  Mapping:`)
    console.log(`    Product ID: ${link.stockx_product_id}`)
    console.log(`    Variant ID: ${link.stockx_variant_id}`)

    // Check for snapshots
    const { data: snapshots, count } = await supabase
      .from('stockx_market_snapshots')
      .select('*', { count: 'exact' })
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)
      .order('snapshot_at', { ascending: false })
      .limit(3)

    console.log(`\n  Snapshots: ${count} found`)

    if (count > 0) {
      console.log(`  Latest snapshot:`)
      const latest = snapshots[0]
      console.log(`    Currency: ${latest.currency_code}`)
      console.log(`    Lowest Ask: ${latest.lowest_ask}`)
      console.log(`    Highest Bid: ${latest.highest_bid}`)
      console.log(`    Snapshot Time: ${latest.snapshot_at}`)
    } else {
      console.log('  ❌ No snapshots found!')

      // Check if product/variant exist in StockX tables
      const { data: product } = await supabase
        .from('stockx_products')
        .select('id, name')
        .eq('stockx_product_id', link.stockx_product_id)
        .single()

      const { data: variant } = await supabase
        .from('stockx_variants')
        .select('id, size_display, variant_value')
        .eq('stockx_variant_id', link.stockx_variant_id)
        .single()

      console.log(`\n  Product exists: ${!!product}`)
      if (product) console.log(`    Name: ${product.name}`)

      console.log(`  Variant exists: ${!!variant}`)
      if (variant) console.log(`    Size: ${variant.size_display || variant.variant_value}`)
    }

    console.log()
  }
}

checkChicagoLows()
