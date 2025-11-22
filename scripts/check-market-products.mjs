#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sku = 'IO3372-700'
const uuidFromMapping = '44d8eef8-bf82-4e3c-8056-25608e54364e'

console.log('🔍 Checking market_products table...\n')

// Check if market_products table exists and has this SKU
const { data: marketProduct, error } = await supabase
  .from('market_products')
  .select('*')
  .eq('sku', sku)
  .eq('provider', 'stockx')
  .maybeSingle()

console.log('📦 Looking for SKU in market_products:', sku)
if (marketProduct) {
  console.log('✅ Found in market_products:')
  console.log(JSON.stringify(marketProduct, null, 2))
} else {
  console.log('❌ Not found in market_products')
  console.log('Error:', error)
}

// Try finding by ID
const { data: byId } = await supabase
  .from('market_products')
  .select('*')
  .eq('id', uuidFromMapping)
  .maybeSingle()

console.log('\n📦 Looking by ID:', uuidFromMapping)
if (byId) {
  console.log('✅ Found by ID:')
  console.log(JSON.stringify(byId, null, 2))
} else {
  console.log('❌ Not found by ID')
}

// Check stockx_market_prices table
const { data: prices } = await supabase
  .from('stockx_market_prices')
  .select('*')
  .eq('sku', sku)
  .limit(5)

console.log('\n💰 StockX market prices for SKU:', sku)
if (prices && prices.length > 0) {
  console.log(`✅ Found ${prices.length} price records:`)
  prices.forEach(p => {
    console.log(`  Size: ${p.size}, Last Sale: ${p.last_sale}, Lowest Ask: ${p.lowest_ask}, Currency: ${p.currency}`)
  })
} else {
  console.log('❌ No price records found')
}

// List all tables to see what exists
console.log('\n📋 Checking what tables exist...')
const { data: tables } = await supabase
  .rpc('exec_sql', {
    sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%market%' OR tablename LIKE '%stockx%' ORDER BY tablename"
  })
  .catch(() => null)

// Alternative way to check
const tableChecks = [
  'market_products',
  'market_prices',  'stockx_products',
  'stockx_variants',
  'stockx_market_prices',
  'stockx_market_snapshots'
]

console.log('\n📊 Table existence check:')
for (const table of tableChecks) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .limit(1)

  if (error) {
    console.log(`  ❌ ${table} - ${error.message}`)
  } else {
    console.log(`  ✅ ${table} exists`)
  }
}
