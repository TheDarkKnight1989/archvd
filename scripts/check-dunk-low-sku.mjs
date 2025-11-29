#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Check the Dunk Low item
const { data, error } = await supabase
  .from('alias_catalog_items')
  .select('*')
  .ilike('product_name', '%dunk low%cacao%')
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('Found item:')
console.log('Product Name:', data.product_name)
console.log('SKU field:', JSON.stringify(data.sku))
console.log('SKU (raw):', data.sku)
console.log('Slug:', data.slug)
console.log('Catalog ID:', data.catalog_id)

// Test SKU matching
const testSkus = ['dd1503-124', 'DD1503-124', 'DD1503124', 'dd1503124', 'DD1503 124']
console.log('\nTesting SKU matches:')
for (const testSku of testSkus) {
  const normalized = testSku.replace(/[-\s]/g, '').toLowerCase()
  const catalogNormalized = (data.sku || '').replace(/[-\s]/g, '').toLowerCase()
  const matches = normalized === catalogNormalized
  console.log(`  ${testSku} -> ${normalized} ${matches ? '✅' : '❌'}`)
}
