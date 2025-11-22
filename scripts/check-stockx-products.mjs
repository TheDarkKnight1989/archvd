#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking StockX products setup...\n')

// Check inventory_market_links
console.log('1️⃣  Checking inventory_market_links...')
const { data: links, error: linksError } = await supabase
  .from('inventory_market_links')
  .select('stockx_product_id, stockx_variant_id')
  .limit(5)

if (linksError) {
  console.error('❌ Error:', linksError.message)
} else {
  console.log('✅ Sample links:')
  console.log(JSON.stringify(links, null, 2))
}

// Check stockx_products
console.log('\n2️⃣  Checking stockx_products table...')
const { data: products, error: productsError } = await supabase
  .from('stockx_products')
  .select('id, stockx_product_id')
  .limit(5)

if (productsError) {
  console.error('❌ Error:', productsError.message)
} else {
  console.log('✅ Sample products:')
  console.log(JSON.stringify(products, null, 2))
}

// Check if product IDs from links exist in products table
if (links && links.length > 0 && links[0].stockx_product_id) {
  console.log('\n3️⃣  Checking if link product IDs exist in stockx_products...')
  const productId = links[0].stockx_product_id
  const { data: match, error: matchError } = await supabase
    .from('stockx_products')
    .select('id, stockx_product_id')
    .eq('stockx_product_id', productId)
    .single()

  if (matchError) {
    console.error(`❌ Product ID ${productId} NOT found in stockx_products`)
    console.error('Error:', matchError.message)
  } else {
    console.log(`✅ Product ID ${productId} found:`)
    console.log(JSON.stringify(match, null, 2))
  }
}

// Count total rows
const { count: linksCount } = await supabase
  .from('inventory_market_links')
  .select('*', { count: 'exact', head: true })

const { count: productsCount } = await supabase
  .from('stockx_products')
  .select('*', { count: 'exact', head: true })

console.log('\n📊 Totals:')
console.log(`inventory_market_links: ${linksCount} rows`)
console.log(`stockx_products: ${productsCount} rows`)
