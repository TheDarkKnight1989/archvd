#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CHICAGO_ITEM_IDS = [
  '729d9d3d-b9e2-4f1e-8286-e235624b2923', // UK 9
  '85a1fbbd-b271-4961-b65b-4d862ec2ac23'  // UK 11
]

console.log('📋 Checking Chicago Low mappings...\n')

for (const itemId of CHICAGO_ITEM_IDS) {
  // Get inventory item
  const { data: item, error: itemError } = await supabase
    .from('inventory')
    .select('id, sku, size_uk')
    .eq('id', itemId)
    .single()

  if (itemError) {
    console.log(`❌ Error fetching item ${itemId}: ${itemError.message}`)
    continue
  }

  // Get market link
  const { data: link, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, mapping_status')
    .eq('item_id', itemId)
    .single()

  if (linkError) {
    console.log(`❌ Error fetching link for ${itemId}: ${linkError.message}\n`)
    continue
  }

  console.log(`Item: ${item.sku} (Size UK ${item.size_uk})`)
  console.log(`  Product ID: ${link.stockx_product_id}`)
  console.log(`  Variant ID: ${link.stockx_variant_id}`)
  console.log(`  Status: ${link.mapping_status}\n`)
}
