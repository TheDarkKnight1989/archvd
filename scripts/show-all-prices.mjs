#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  // Get all inventory items
  const { data: inventory, error: invError } = await supabase
    .from('Inventory')
    .select('id, sku, size, brand, model, status')
    .order('sku')

  if (invError) {
    console.error('Error fetching inventory:', invError)
    process.exit(1)
  }

  console.log('\n📊 ALL INVENTORY ITEMS WITH STOCKX PRICES\n')
  console.log('='.repeat(100))

  if (!inventory || inventory.length === 0) {
    console.log('No inventory items found')
    process.exit(0)
  }

  // For each item, get StockX mapping and market data
  for (const item of inventory) {
    console.log(`\n${inventory.indexOf(item) + 1}. ${item.brand} ${item.model}`)
    console.log(`   SKU: ${item.sku}`)
    console.log(`   Size: ${item.size || 'N/A'}`)

    // Get StockX mapping
    const { data: links } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', item.id)
      .limit(1)

    if (!links || links.length === 0) {
      console.log(`   ❌ No StockX mapping`)
      continue
    }

    const link = links[0]

    // Get latest market data
    const { data: market } = await supabase
      .from('stockx_market_latest')
      .select('currency_code, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)

    if (!market || market.length === 0) {
      console.log(`   ⚠️  Mapped but no market data`)
      console.log(`   StockX Product: ${link.stockx_product_id.substring(0, 12)}...`)
      continue
    }

    // Show all currencies
    market.forEach(m => {
      console.log(`   Currency: ${m.currency_code}`)
      console.log(`   Lowest Ask: ${m.lowest_ask ?? 'NULL'} ${m.currency_code}`)
      console.log(`   Highest Bid: ${m.highest_bid ?? 'NULL'} ${m.currency_code}`)
      console.log(`   Last Updated: ${m.snapshot_at ? new Date(m.snapshot_at).toLocaleString() : 'Never'}`)
    })
    console.log(`   StockX Product: ${link.stockx_product_id.substring(0, 12)}...`)
  }

  console.log('\n' + '='.repeat(100))
  console.log(`Total: ${inventory.length} items\n`)
}

main().catch(console.error)
