#!/usr/bin/env node
/**
 * Delete Broken Chicago Low Mappings
 * Removes inventory_market_links records pointing to invalid StockX product
 */

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

console.log('🗑️  Deleting broken Chicago Low mappings...\n')

for (const itemId of CHICAGO_ITEM_IDS) {
  // Get current mapping details before deletion
  const { data: beforeMapping } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, mapping_status')
    .eq('item_id', itemId)
    .single()

  if (beforeMapping) {
    console.log(`Item ${itemId}:`)
    console.log(`  Product ID: ${beforeMapping.stockx_product_id}`)
    console.log(`  Variant ID: ${beforeMapping.stockx_variant_id}`)
    console.log(`  Status: ${beforeMapping.mapping_status}`)
  }

  // Delete the mapping
  const { error } = await supabase
    .from('inventory_market_links')
    .delete()
    .eq('item_id', itemId)

  if (error) {
    console.log(`  ❌ Failed to delete: ${error.message}\n`)
  } else {
    console.log(`  ✅ Mapping deleted\n`)
  }
}

console.log('✨ Done! Chicago items are now unmapped and ready to be re-mapped.\n')
