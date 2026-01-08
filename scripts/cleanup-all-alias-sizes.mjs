/**
 * Cleanup ALL Alias products with invalid sizes
 * Run after audit-all-alias-sizes.mjs shows products needing cleanup
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const dryRun = process.argv.includes('--dry-run')

async function main() {
  console.log('='.repeat(80))
  console.log('BULK ALIAS SIZE CLEANUP')
  console.log('='.repeat(80))
  console.log('')
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE (will delete data)'}`)
  console.log('')

  // Get all products with allowed_sizes
  const { data: products, error } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, sku, name, allowed_sizes')

  if (error) {
    console.error('Error fetching products:', error.message)
    return
  }

  let totalVariantsDeleted = 0
  let totalMarketDataDeleted = 0
  let productsProcessed = 0

  for (const p of products || []) {
    const allowedSizes = new Set((p.allowed_sizes || []).map(s => parseFloat(s.value)))

    if (allowedSizes.size === 0) continue

    // Get variants for this product
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('id, size_value')
      .eq('alias_catalog_id', p.alias_catalog_id)

    const invalidVariants = (variants || []).filter(v => !allowedSizes.has(v.size_value))

    if (invalidVariants.length === 0) continue

    productsProcessed++
    const invalidVariantIds = invalidVariants.map(v => v.id)

    console.log(`${p.sku}: ${invalidVariants.length} invalid variants`)

    if (!dryRun) {
      // Delete market_data first (FK)
      const { count: mdDeleted } = await supabase
        .from('inventory_v4_alias_market_data')
        .delete({ count: 'exact' })
        .in('alias_variant_id', invalidVariantIds)

      // Delete variants
      const { count: varDeleted } = await supabase
        .from('inventory_v4_alias_variants')
        .delete({ count: 'exact' })
        .in('id', invalidVariantIds)

      totalMarketDataDeleted += mdDeleted || 0
      totalVariantsDeleted += varDeleted || 0
    } else {
      totalVariantsDeleted += invalidVariants.length
      totalMarketDataDeleted += invalidVariants.length // Approximate
    }
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Products processed: ${productsProcessed}`)
  console.log(`Variants ${dryRun ? 'to delete' : 'deleted'}: ${totalVariantsDeleted}`)
  console.log(`Market data ${dryRun ? 'to delete' : 'deleted'}: ${totalMarketDataDeleted}`)
  console.log('')

  if (dryRun) {
    console.log('🔍 DRY RUN - No changes made.')
    console.log('Run without --dry-run to execute cleanup.')
  } else {
    console.log('✅ CLEANUP COMPLETE')
  }
}

main()
