#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking Mars Yard (AA2261-100) StockX price data...\n')

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

// Get the inventory item
const { data: item } = await supabase
  .from('Inventory')
  .select('id, sku, size')
  .eq('user_id', userId)
  .eq('sku', 'AA2261-100')
  .single()

console.log('📦 Inventory item:', item)

if (!item) {
  console.log('❌ Item not found')
  process.exit(1)
}

// Get the mapping
const { data: mapping } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('item_id', item.id)
  .maybeSingle()

console.log('\n🔗 StockX mapping:', mapping)

if (!mapping) {
  console.log('❌ No StockX mapping found')
  process.exit(1)
}

// Get ALL price data for this product/variant
const { data: allPrices } = await supabase
  .from('stockx_market_latest')
  .select('*')
  .eq('stockx_product_id', mapping.stockx_product_id)
  .eq('stockx_variant_id', mapping.stockx_variant_id)

console.log('\n💰 All StockX prices for this variant:')
for (const price of allPrices || []) {
  console.log(`   ${price.currency_code}: lowest_ask=${price.lowest_ask}, highest_bid=${price.highest_bid}, last_sale=${price.last_sale_price}`)
}

// Check the specific GBP price
const { data: gbpPrice } = await supabase
  .from('stockx_market_latest')
  .select('*')
  .eq('stockx_product_id', mapping.stockx_product_id)
  .eq('stockx_variant_id', mapping.stockx_variant_id)
  .eq('currency_code', 'GBP')
  .single()

console.log('\n💷 GBP price details:')
console.log(JSON.stringify(gbpPrice, null, 2))

// Check the stockx_market_snapshots to see raw data
const { data: snapshots } = await supabase
  .from('stockx_market_snapshots')
  .select('*')
  .eq('stockx_product_id', mapping.stockx_product_id)
  .eq('stockx_variant_id', mapping.stockx_variant_id)
  .eq('currency_code', 'GBP')
  .order('snapshot_at', { ascending: false })
  .limit(3)

console.log('\n📸 Recent snapshots (last 3):')
for (const snap of snapshots || []) {
  console.log(`   ${snap.snapshot_at}: lowest_ask=${snap.lowest_ask}, highest_bid=${snap.highest_bid}, last_sale=${snap.last_sale_price}`)
}

// Get the product details
const { data: product } = await supabase
  .from('stockx_products')
  .select('*')
  .eq('stockx_product_id', mapping.stockx_product_id)
  .single()

console.log('\n👟 Product:', product?.title)
console.log('    SKU:', product?.style_id)

console.log('\n🔍 What the hook uses:')
console.log('   Key format: stockx_product_id:stockx_variant_id:currency_code')
console.log(`   Lookup key: ${mapping.stockx_product_id}:${mapping.stockx_variant_id}:GBP`)
console.log(`   Found price: ${gbpPrice?.lowest_ask}`)
