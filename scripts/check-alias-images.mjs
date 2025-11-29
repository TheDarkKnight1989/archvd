import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking alias_catalog_items for image data...\n')

// Check for known SKUs
const knownSkus = ['DZ5485-612', 'DD1503-124', 'HQ6316']

const { data: catalogItems, error } = await supabase
  .from('alias_catalog_items')
  .select('catalog_id, sku, product_name, image_url, thumbnail_url')
  .in('sku', knownSkus)

if (error) {
  console.error('❌ Error fetching catalog items:', error)
  process.exit(1)
}

console.log(`Found ${catalogItems ? catalogItems.length : 0} catalog items for known SKUs:\n`)

if (catalogItems) {
  catalogItems.forEach(item => {
    console.log(`📦 ${item.product_name}`)
    console.log(`   SKU: ${item.sku}`)
    console.log(`   Catalog ID: ${item.catalog_id}`)
    console.log(`   Image URL: ${item.image_url ? '✅ ' + item.image_url.substring(0, 60) + '...' : '❌ NULL'}`)
    console.log(`   Thumbnail URL: ${item.thumbnail_url ? '✅ ' + item.thumbnail_url.substring(0, 60) + '...' : '❌ NULL'}`)
    console.log('')
  })
}

// Also check how many items we have in inventory_alias_links
const { data: links, error: linksError } = await supabase
  .from('inventory_alias_links')
  .select('inventory_id, alias_catalog_id')

console.log(`\n📊 Total alias mappings: ${links ? links.length : 0}`)

if (links && links.length > 0) {
  // Check if catalog items exist for these mappings
  const catalogIds = links.map(l => l.alias_catalog_id)
  const { data: mapped, error: mappedError } = await supabase
    .from('alias_catalog_items')
    .select('catalog_id, image_url')
    .in('catalog_id', catalogIds)

  const withImages = mapped ? mapped.filter(m => m.image_url) : []
  const withoutImages = mapped ? mapped.filter(m => !m.image_url) : []

  console.log(`   ✅ With images: ${withImages.length}`)
  console.log(`   ❌ Without images: ${withoutImages.length}`)

  if (withoutImages.length > 0) {
    console.log('\n⚠️  Catalog items missing images:')
    withoutImages.slice(0, 5).forEach(m => {
      console.log(`   - ${m.catalog_id}`)
    })
  }
}
