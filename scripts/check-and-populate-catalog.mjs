#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

console.log('🔍 Checking alias_catalog_items table...\n')

// Check how many catalog items we have
const { data: catalogItems, error: catalogError } = await supabase
  .from('alias_catalog_items')
  .select('catalog_id, image_url, product_name')

if (catalogError) {
  console.error('❌ Error:', catalogError)
  process.exit(1)
}

console.log(`📊 Found ${catalogItems.length} catalog items in database`)

const withImages = catalogItems.filter(item => item.image_url)
const withoutImages = catalogItems.filter(item => !item.image_url)

console.log(`   ✅ With images: ${withImages.length}`)
console.log(`   ❌ Without images: ${withoutImages.length}\n`)

// Check inventory_alias_links to see what we need to fetch
const { data: links, error: linksError } = await supabase
  .from('inventory_alias_links')
  .select('alias_catalog_id')

if (linksError) {
  console.error('❌ Error fetching links:', linksError)
  process.exit(1)
}

console.log(`📦 Found ${links.length} inventory items with Alias mappings`)

// Find catalog IDs that are linked but not in catalog_items
const linkedCatalogIds = new Set(links.map(l => l.alias_catalog_id))
const cachedCatalogIds = new Set(catalogItems.map(c => c.catalog_id))

const missingCatalogIds = [...linkedCatalogIds].filter(id => !cachedCatalogIds.has(id))

if (missingCatalogIds.length > 0) {
  console.log(`\n⚠️  ${missingCatalogIds.length} catalog items need to be fetched from Alias API:`)
  missingCatalogIds.slice(0, 5).forEach(id => console.log(`   - ${id}`))
  if (missingCatalogIds.length > 5) {
    console.log(`   ... and ${missingCatalogIds.length - 5} more`)
  }

  console.log('\n💡 To populate these, run:')
  console.log('   node scripts/populate-alias-catalog.mjs')
} else {
  console.log('\n✅ All linked items are already in catalog cache!')
}

// Sample a few items to show image status
if (catalogItems.length > 0) {
  console.log('\n📸 Sample catalog items:')
  catalogItems.slice(0, 3).forEach(item => {
    console.log(`   ${item.product_name}`)
    console.log(`     Image: ${item.image_url ? '✅ ' + item.image_url.substring(0, 50) + '...' : '❌ NULL'}`)
  })
}
