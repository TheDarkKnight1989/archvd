#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Check catalog items
const { data: catalogItems, error } = await supabase
  .from('alias_catalog_items')
  .select('catalog_id, slug, product_name, sku')
  .limit(10)

if (error) {
  console.error('Error fetching catalog items:', error)
  process.exit(1)
}

console.log(`Found ${catalogItems?.length || 0} catalog items:`)
catalogItems?.forEach((item) => {
  console.log(`  - ${item.product_name} (${item.sku})`)
  console.log(`    Slug: ${item.slug}`)
  console.log(`    Catalog ID: ${item.catalog_id}`)
  console.log()
})

// Check if the specific slug from the URL exists
const testSlug = 'nike-nike-dunk-low-cacao-wow-womens-dd1503-124'
const { data: testItem, error: testError } = await supabase
  .from('alias_catalog_items')
  .select('*')
  .eq('slug', testSlug)
  .maybeSingle()

console.log(`\nLooking for slug: ${testSlug}`)
if (testError) {
  console.error('Error:', testError)
} else if (testItem) {
  console.log('✅ Found item:', testItem.product_name)
} else {
  console.log('❌ No item found with that slug')
}
