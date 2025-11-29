#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log('📋 Checking stockx_products schema...\n')

const { data: products } = await supabase
  .from('stockx_products')
  .select('*')
  .limit(1)

if (products && products.length > 0) {
  console.log('stockx_products columns:', Object.keys(products[0]))
  console.log('Sample row:', products[0])
} else {
  console.log('No products found')
}

console.log('\n📋 Checking stockx_variants schema...\n')

const { data: variants } = await supabase
  .from('stockx_variants')
  .select('*')
  .limit(1)

if (variants && variants.length > 0) {
  console.log('stockx_variants columns:', Object.keys(variants[0]))
  console.log('Sample row:', variants[0])
} else {
  console.log('No variants found')
}

console.log('\n📋 Checking stockx_listings schema...\n')

const { data: listings } = await supabase
  .from('stockx_listings')
  .select('*')
  .limit(1)

if (listings && listings.length > 0) {
  console.log('stockx_listings columns:', Object.keys(listings[0]))
  console.log('Sample row:', listings[0])
} else {
  console.log('No listings found')
}
