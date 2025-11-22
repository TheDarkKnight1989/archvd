#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking AA2261-100 mapping and market data...\n')

// Find the item
const { data: items, error: itemError } = await supabase
  .from('Inventory')
  .select('id, sku, size_uk, brand, model')
  .eq('sku', 'AA2261-100')
  .limit(1)

if (itemError) {
  console.error('❌ Error fetching item:', itemError.message)
  process.exit(1)
}

if (!items || items.length === 0) {
  console.log('❌ No item found with SKU AA2261-100')
  process.exit(0)
}

const item = items[0]
console.log('📦 Item found:')
console.log(`   ID: ${item.id}`)
console.log(`   SKU: ${item.sku}`)
console.log(`   Brand: ${item.brand}`)
console.log(`   Model: ${item.model}`)
console.log(`   Size UK: ${item.size_uk}\n`)

// Check mapping
const { data: mappings, error: mappingError } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('item_id', item.id)

if (mappingError) {
  console.error('❌ Error fetching mapping:', mappingError.message)
  process.exit(1)
}

if (!mappings || mappings.length === 0) {
  console.log('❌ No StockX mapping found in inventory_market_links')
  process.exit(0)
}

const mapping = mappings[0]
console.log('🔗 Mapping found:')
console.log(`   StockX Product ID: ${mapping.stockx_product_id}`)
console.log(`   StockX Variant ID: ${mapping.stockx_variant_id}\n`)

// Check market data
const { data: marketData, error: marketError } = await supabase
  .from('stockx_market_latest')
  .select('*')
  .eq('stockx_product_id', mapping.stockx_product_id)
  .eq('stockx_variant_id', mapping.stockx_variant_id)
  .eq('currency_code', 'GBP')

if (marketError) {
  console.error('❌ Error fetching market data:', marketError.message)
  process.exit(1)
}

if (!marketData || marketData.length === 0) {
  console.log('❌ No market data found in stockx_market_latest')
  process.exit(0)
}

const market = marketData[0]
console.log('💰 Market data (GBP):')
console.log(`   Last Sale: ${market.last_sale ? `£${(market.last_sale / 100).toFixed(2)}` : '—'}`)
console.log(`   Lowest Ask: ${market.lowest_ask ? `£${(market.lowest_ask / 100).toFixed(2)}` : '—'}`)
console.log(`   Highest Bid: ${market.highest_bid ? `£${(market.highest_bid / 100).toFixed(2)}` : '—'}`)
console.log(`   Updated: ${market.as_of}\n`)

console.log('✅ All data present - item should show StockX actions\n')
