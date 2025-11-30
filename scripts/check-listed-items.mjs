#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking items with status="listed"...\n')

// Get items where status is 'listed'
const { data: items, error } = await supabase
  .from('Inventory')
  .select('id, sku, brand, model, status')
  .eq('status', 'listed')
  .limit(5)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Found ${items.length} items with status="listed"\n`)

for (const item of items) {
  console.log(`📦 ${item.brand} ${item.model}`)
  console.log(`   ID: ${item.id}`)
  console.log(`   SKU: ${item.sku}`)
  console.log(`   Status: ${item.status}`)
  
  // Check if it has a market link
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('stockx_listing_id, stockx_listing_status')
    .eq('item_id', item.id)
    .single()
  
  if (link) {
    console.log(`   StockX Listing ID: ${link.stockx_listing_id || 'NULL'}`)
    console.log(`   StockX Status: ${link.stockx_listing_status || 'NULL'}`)
  } else {
    console.log(`   No market link found`)
  }
  console.log('')
}
