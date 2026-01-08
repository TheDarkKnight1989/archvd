/**
 * Audit ALL Alias products for invalid sizes
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Get all products with allowed_sizes
  const { data: products, error } = await supabase
    .from('inventory_v4_alias_products')
    .select('alias_catalog_id, sku, name, allowed_sizes')

  if (error) {
    console.error('Error fetching products:', error.message)
    return
  }

  console.log('Total Alias products:', products?.length)
  console.log('')

  let totalInvalid = 0
  let totalVariants = 0
  let productsWithInvalid = 0
  const invalidProducts = []

  for (const p of products || []) {
    const allowedSizes = new Set((p.allowed_sizes || []).map(s => parseFloat(s.value)))

    if (allowedSizes.size === 0) continue // Skip products with no allowed_sizes

    // Get variants for this product
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('size_value')
      .eq('alias_catalog_id', p.alias_catalog_id)

    const variantCount = variants?.length || 0
    totalVariants += variantCount

    const invalidVariants = (variants || []).filter(v => !allowedSizes.has(v.size_value))
    const invalidCount = invalidVariants.length

    if (invalidCount > 0) {
      productsWithInvalid++
      totalInvalid += invalidCount
      const invalidSizes = [...new Set(invalidVariants.map(v => v.size_value))].sort((a, b) => a - b)
      invalidProducts.push({
        sku: p.sku,
        catalogId: p.alias_catalog_id,
        invalidCount,
        invalidSizes: invalidSizes.slice(0, 10).join(', ') + (invalidSizes.length > 10 ? '...' : '')
      })
    }
  }

  console.log('=== PRODUCTS WITH INVALID SIZES ===')
  for (const p of invalidProducts) {
    console.log(`  ${p.sku}: ${p.invalidCount} invalid (${p.invalidSizes})`)
  }

  console.log('')
  console.log('=== SUMMARY ===')
  console.log(`Total products: ${products?.length}`)
  console.log(`Total variants: ${totalVariants}`)
  console.log(`Products with invalid sizes: ${productsWithInvalid}`)
  console.log(`Total invalid variants to clean: ${totalInvalid}`)
  console.log('')

  if (totalInvalid > 0) {
    console.log('Run cleanup for all products:')
    for (const p of invalidProducts) {
      console.log(`  node scripts/cleanup-invalid-alias-sizes.mjs ${p.catalogId}`)
    }
  }
}

main()
