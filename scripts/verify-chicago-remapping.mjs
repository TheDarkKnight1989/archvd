#!/usr/bin/env node
/**
 * Verify Chicago Low Re-mapping
 * Checks the new product IDs and validates they work
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

const OLD_GHOST_PRODUCT_ID = '83c11c36-1e00-4831-85e5-6067abf2f18b'

console.log('✅ Verifying Chicago Low re-mapping...\n')

for (const itemId of CHICAGO_ITEM_IDS) {
  // Get inventory item details
  const { data: item } = await supabase
    .from('inventory')
    .select('id, sku, size_uk')
    .eq('id', itemId)
    .single()

  if (!item) {
    console.log(`❌ Item ${itemId} not found\n`)
    continue
  }

  // Get new mapping
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, mapping_status, created_at, updated_at')
    .eq('item_id', itemId)
    .single()

  if (!link) {
    console.log(`❌ No mapping found for ${item.sku} (Size UK ${item.size_uk})\n`)
    continue
  }

  console.log(`Item: ${item.sku} (Size UK ${item.size_uk})`)
  console.log(`  Product ID: ${link.stockx_product_id}`)
  console.log(`  Variant ID: ${link.stockx_variant_id}`)
  console.log(`  Status: ${link.mapping_status}`)
  console.log(`  Updated: ${new Date(link.updated_at).toISOString()}`)

  // Check if it's different from the old ghost product
  if (link.stockx_product_id === OLD_GHOST_PRODUCT_ID) {
    console.log(`  ⚠️  WARNING: Still mapped to OLD GHOST PRODUCT!\n`)
  } else {
    console.log(`  ✅ New product ID (different from ghost product)\n`)
  }

  // Check if product exists in local database
  const { data: product } = await supabase
    .from('stockx_products')
    .select('id, title, style_id, brand')
    .eq('id', link.stockx_product_id)
    .single()

  if (product) {
    console.log(`  ✅ Product exists in database:`)
    console.log(`     Title: ${product.title}`)
    console.log(`     Style ID: ${product.style_id}`)
    console.log(`     Brand: ${product.brand}\n`)
  } else {
    console.log(`  ⚠️  Product NOT in local database (may need backfill)\n`)
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Summary: If both items show new product IDs, re-mapping succeeded!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
