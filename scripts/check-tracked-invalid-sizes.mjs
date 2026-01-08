import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Get all alias_catalog_ids from style_catalog
  const { data: styles } = await supabase
    .from('inventory_v4_style_catalog')
    .select('alias_catalog_id')
    .not('alias_catalog_id', 'is', null)

  const catalogIds = styles.map(s => s.alias_catalog_id)
  console.log('Tracked alias_catalog_ids:', catalogIds.length)

  // Check if these exist in alias_products
  const { data: products } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, allowed_sizes')
    .in('alias_catalog_id', catalogIds)

  console.log('Found in alias_products:', products?.length || 0)

  // Count total variants for tracked styles
  let totalVariants = 0
  let invalidVariants = 0
  let productsWithInvalid = 0
  const invalidDetails = []

  for (const p of products || []) {
    const allowedSizes = new Set((p.allowed_sizes || []).map(s => parseFloat(s.value)))
    if (allowedSizes.size === 0) continue

    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('size_value')
      .eq('alias_catalog_id', p.alias_catalog_id)

    const invalid = (variants || []).filter(v => !allowedSizes.has(v.size_value))
    totalVariants += (variants || []).length
    invalidVariants += invalid.length
    if (invalid.length > 0) {
      productsWithInvalid++
      invalidDetails.push({ id: p.alias_catalog_id, count: invalid.length })
    }
  }

  console.log('\n=== CURRENT STATE (TRACKED STYLES) ===')
  console.log('Total variants:', totalVariants)
  console.log('Invalid variants:', invalidVariants)
  console.log('Products with invalid:', productsWithInvalid)

  if (invalidDetails.length > 0) {
    console.log('\nTop 10 by invalid count:')
    invalidDetails.sort((a, b) => b.count - a.count).slice(0, 10).forEach(d => {
      console.log(`  ${d.id}: ${d.count}`)
    })
  }
}

main()
