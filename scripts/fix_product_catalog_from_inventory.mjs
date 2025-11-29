/**
 * One-off Product Catalog Cleanup Script
 *
 * Scans all inventory items and fixes broken catalog entries
 * by re-running the canonical createOrUpdateProductFromStockx function.
 *
 * DO NOT RUN YET - FOR COMPILATION ONLY
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================================================
// Helpers
// ============================================================================

function isBrokenCatalogEntry(catalogRow) {
  // Detect placeholder/broken entries
  if (!catalogRow) return true

  // Check for "Product XXX" style names
  if (catalogRow.model && catalogRow.model.startsWith('Product ')) {
    return true
  }

  // Check for missing brand
  if (!catalogRow.brand || catalogRow.brand === 'Unknown') {
    return true
  }

  // Check for missing image
  if (!catalogRow.image_url) {
    return true
  }

  // Check for missing stockx_product_id
  if (!catalogRow.stockx_product_id) {
    return true
  }

  return false
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('🔧 Product Catalog Cleanup Script')
  console.log('=' .repeat(60))
  console.log('')

  const stats = {
    total: 0,
    alreadyGood: 0,
    fixed: 0,
    failed: 0,
    skipped: 0,
  }

  try {
    // ========================================================================
    // Step 1: Fetch all inventory items with their catalog links
    // ========================================================================

    console.log('📦 Fetching inventory items...')
    const { data: inventoryItems, error: inventoryError } = await supabase
      .from('Inventory')
      .select('id, sku, brand, model')
      .in('status', ['active', 'listed', 'worn'])
      .order('created_at', { ascending: false })

    if (inventoryError) {
      throw new Error(`Failed to fetch inventory: ${inventoryError.message}`)
    }

    console.log(`Found ${inventoryItems.length} inventory items`)
    stats.total = inventoryItems.length

    // ========================================================================
    // Step 2: Process each inventory item
    // ========================================================================

    for (const item of inventoryItems) {
      console.log('')
      console.log(`Processing: ${item.sku} (${item.id})`)

      // Get catalog entry for this SKU
      const { data: catalogRow, error: catalogError } = await supabase
        .from('product_catalog')
        .select('*')
        .eq('sku', item.sku)
        .maybeSingle()

      if (catalogError) {
        console.error(`  ❌ Error fetching catalog: ${catalogError.message}`)
        stats.failed++
        continue
      }

      // Check if catalog entry is broken
      if (!isBrokenCatalogEntry(catalogRow)) {
        console.log(`  ✅ Catalog entry looks good`)
        stats.alreadyGood++
        continue
      }

      console.log(`  ⚠️  Broken catalog entry detected:`)
      if (catalogRow) {
        console.log(`      Model: ${catalogRow.model}`)
        console.log(`      Brand: ${catalogRow.brand}`)
        console.log(`      Image: ${catalogRow.image_url ? 'yes' : 'NO'}`)
        console.log(`      StockX ID: ${catalogRow.stockx_product_id || 'NO'}`)
      } else {
        console.log(`      No catalog entry exists`)
      }

      // Fix by calling canonical function
      console.log(`  🔧 Re-creating from StockX...`)

      try {
        // NOTE: This would call the canonical function
        // For now, just log what we would do
        console.log(`  TODO: Call createOrUpdateProductFromStockx({ sku: "${item.sku}" })`)

        // In real implementation:
        // const { createOrUpdateProductFromStockx } = await import('../src/lib/catalog/stockx.ts')
        // const result = await createOrUpdateProductFromStockx({ sku: item.sku })
        // if (result.success) {
        //   console.log(`  ✅ Fixed: ${result.productCatalogId}`)
        //   stats.fixed++
        // } else {
        //   console.error(`  ❌ Failed: ${result.error}`)
        //   stats.failed++
        // }

        stats.skipped++ // For now, just count as skipped since we're not running yet

      } catch (error) {
        console.error(`  ❌ Error fixing: ${error.message}`)
        stats.failed++
      }
    }

    // ========================================================================
    // Step 3: Summary
    // ========================================================================

    console.log('')
    console.log('=' .repeat(60))
    console.log('📊 Summary:')
    console.log(`  Total items:        ${stats.total}`)
    console.log(`  Already good:       ${stats.alreadyGood}`)
    console.log(`  Fixed:              ${stats.fixed}`)
    console.log(`  Failed:             ${stats.failed}`)
    console.log(`  Skipped:            ${stats.skipped}`)
    console.log('=' .repeat(60))

  } catch (error) {
    console.error('')
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// ============================================================================
// Run
// ============================================================================

console.log('')
console.log('⚠️  WARNING: This is a COMPILATION-ONLY script')
console.log('⚠️  Do NOT run this yet until the canonical function is tested')
console.log('')

// Uncomment to actually run:
// main().catch(console.error)

console.log('✅ Script compiled successfully (but did not run)')
