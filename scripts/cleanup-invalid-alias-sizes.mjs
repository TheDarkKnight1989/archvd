/**
 * Cleanup Invalid Alias Sizes
 *
 * Deletes variants and market_data rows where size_value is NOT in the product's allowed_sizes.
 * Safe: scoped to specific catalog_id, logs before/after counts.
 *
 * Usage:
 *   node scripts/cleanup-invalid-alias-sizes.mjs <catalog_id> [--dry-run]
 *
 * Examples:
 *   node scripts/cleanup-invalid-alias-sizes.mjs air-jordan-4-retro-military-black-dh6927-111 --dry-run
 *   node scripts/cleanup-invalid-alias-sizes.mjs air-jordan-4-retro-military-black-dh6927-111
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const catalogId = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!catalogId) {
    console.error('Usage: node scripts/cleanup-invalid-alias-sizes.mjs <catalog_id> [--dry-run]')
    process.exit(1)
  }

  console.log('='.repeat(80))
  console.log('ALIAS INVALID SIZE CLEANUP')
  console.log('='.repeat(80))
  console.log('')
  console.log(`Catalog ID: ${catalogId}`)
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE (will delete data)'}`)
  console.log('')

  // Step 1: Get product and allowed_sizes
  const { data: product, error: productErr } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, sku, name, allowed_sizes')
    .eq('alias_catalog_id', catalogId)
    .single()

  if (productErr || !product) {
    console.error('❌ Product not found:', productErr?.message || 'No data')
    process.exit(1)
  }

  console.log(`SKU: ${product.sku}`)
  console.log(`Name: ${product.name}`)

  const allowedSizes = new Set(
    (product.allowed_sizes || []).map(s => parseFloat(s.value))
  )

  console.log(`allowed_sizes count: ${allowedSizes.size}`)
  console.log(`allowed_sizes: ${[...allowedSizes].sort((a, b) => a - b).join(', ')}`)
  console.log('')

  // Step 2: Get all variants for this catalog
  const { data: variants, error: varErr } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, size_value, region_id, consigned')
    .eq('alias_catalog_id', catalogId)

  if (varErr) {
    console.error('❌ Error fetching variants:', varErr.message)
    process.exit(1)
  }

  console.log(`Total variants in DB: ${variants.length}`)

  // Find invalid variants
  const invalidVariants = variants.filter(v => !allowedSizes.has(v.size_value))
  const validVariants = variants.filter(v => allowedSizes.has(v.size_value))

  console.log(`Valid variants (size in allowed_sizes): ${validVariants.length}`)
  console.log(`Invalid variants (size NOT in allowed_sizes): ${invalidVariants.length}`)
  console.log('')

  if (invalidVariants.length === 0) {
    console.log('✅ No invalid variants found. Nothing to clean up.')
    return
  }

  // Show invalid sizes
  const invalidSizes = [...new Set(invalidVariants.map(v => v.size_value))].sort((a, b) => a - b)
  console.log(`Invalid sizes to delete: ${invalidSizes.join(', ')}`)
  console.log('')

  // Get variant IDs for market_data deletion
  const invalidVariantIds = invalidVariants.map(v => v.id)

  // Step 3: Count market_data rows to delete
  const { count: marketDataCount, error: mdCountErr } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: true })
    .in('alias_variant_id', invalidVariantIds)

  if (mdCountErr) {
    console.error('❌ Error counting market_data:', mdCountErr.message)
    process.exit(1)
  }

  console.log('=== BEFORE CLEANUP ===')
  console.log(`Variants to delete: ${invalidVariants.length}`)
  console.log(`Market data rows to delete: ${marketDataCount}`)
  console.log('')

  if (dryRun) {
    console.log('🔍 DRY RUN - No changes made.')
    console.log('')
    console.log('To execute cleanup, run without --dry-run:')
    console.log(`  node scripts/cleanup-invalid-alias-sizes.mjs ${catalogId}`)
    return
  }

  // Step 4: Delete market_data first (FK constraint)
  console.log('Deleting market_data rows...')
  const { error: mdDeleteErr, count: mdDeleted } = await supabase
    .from('inventory_v4_alias_market_data')
    .delete({ count: 'exact' })
    .in('alias_variant_id', invalidVariantIds)

  if (mdDeleteErr) {
    console.error('❌ Error deleting market_data:', mdDeleteErr.message)
    process.exit(1)
  }
  console.log(`  Deleted ${mdDeleted} market_data rows`)

  // Step 5: Delete variants
  console.log('Deleting variant rows...')
  const { error: varDeleteErr, count: varDeleted } = await supabase
    .from('inventory_v4_alias_variants')
    .delete({ count: 'exact' })
    .in('id', invalidVariantIds)

  if (varDeleteErr) {
    console.error('❌ Error deleting variants:', varDeleteErr.message)
    process.exit(1)
  }
  console.log(`  Deleted ${varDeleted} variant rows`)
  console.log('')

  // Step 6: Verify cleanup
  const { data: remainingVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('size_value')
    .eq('alias_catalog_id', catalogId)

  const remainingSizes = [...new Set(remainingVariants.map(v => v.size_value))].sort((a, b) => a - b)
  const stillInvalid = remainingSizes.filter(s => !allowedSizes.has(s))

  console.log('=== AFTER CLEANUP ===')
  console.log(`Remaining variants: ${remainingVariants.length}`)
  console.log(`Remaining sizes: ${remainingSizes.join(', ')}`)
  console.log(`Invalid sizes remaining: ${stillInvalid.length === 0 ? 'NONE ✅' : stillInvalid.join(', ')}`)
  console.log('')
  console.log('='.repeat(80))
  console.log('CLEANUP COMPLETE')
  console.log('='.repeat(80))
}

main().catch(console.error)
