#!/usr/bin/env node

/**
 * Backfill product_catalog from existing inventory
 *
 * Scans all inventory items and ensures each has a product_catalog entry.
 * If missing, auto-creates by searching StockX/Alias.
 *
 * SAFE TO RUN MULTIPLE TIMES - idempotent
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// Main Backfill Function
// ============================================================================

async function backfillCatalog() {
  console.log('🔧 Starting product_catalog backfill...\n')

  // Step 1: Get all unique SKUs from inventory
  console.log('📦 Fetching all inventory items...')

  const { data: inventory, error: inventoryError } = await supabase
    .from('portfolio_inventory')
    .select('sku')

  if (inventoryError) {
    console.error('❌ Failed to fetch inventory:', inventoryError)
    process.exit(1)
  }

  if (!inventory || inventory.length === 0) {
    console.log('✅ No inventory items found - nothing to backfill')
    process.exit(0)
  }

  // Get unique SKUs
  const uniqueSkus = [...new Set(inventory.map(item => item.sku).filter(Boolean))]

  console.log(`📊 Found ${inventory.length} inventory items with ${uniqueSkus.length} unique SKUs\n`)

  // Step 2: For each SKU, check if catalog entry exists
  let checkedCount = 0
  let alreadyExistsCount = 0
  let createdCount = 0
  let failedCount = 0

  const failed = []

  for (const sku of uniqueSkus) {
    checkedCount++
    console.log(`[${checkedCount}/${uniqueSkus.length}] Checking SKU: ${sku}`)

    // Normalize SKU
    const normalizedSku = sku.toUpperCase().replace(/[-\s]/g, ' ').replace(/\s+/g, ' ').trim()

    // Check if catalog entry exists
    const { data: existing, error: checkError } = await supabase
      .from('product_catalog')
      .select('sku')
      .eq('sku', normalizedSku)
      .maybeSingle()

    if (checkError) {
      console.error(`  ❌ Query error:`, checkError.message)
      failedCount++
      failed.push({ sku, error: checkError.message })
      continue
    }

    if (existing) {
      console.log(`  ✅ Already exists (SKU: ${existing.sku})`)
      alreadyExistsCount++
      continue
    }

    // Catalog entry missing - attempt auto-heal
    console.log(`  ⚠️  Missing - attempting auto-heal...`)

    try {
      const result = await ensureProductInCatalogForSku(normalizedSku)

      if (result.success) {
        console.log(`  ✅ Created (SKU: ${result.catalogItemSku}, source: ${result.source})`)
        createdCount++
      } else {
        console.log(`  ❌ Failed: ${result.error}`)
        failedCount++
        failed.push({ sku: normalizedSku, error: result.error })
      }
    } catch (error) {
      console.error(`  ❌ Unexpected error:`, error.message)
      failedCount++
      failed.push({ sku: normalizedSku, error: error.message })
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Step 3: Print summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Backfill Summary')
  console.log('='.repeat(60))
  console.log(`Total SKUs checked:     ${checkedCount}`)
  console.log(`Already in catalog:     ${alreadyExistsCount}`)
  console.log(`Successfully created:   ${createdCount}`)
  console.log(`Failed:                 ${failedCount}`)
  console.log('='.repeat(60))

  if (failed.length > 0) {
    console.log('\n❌ Failed SKUs:')
    failed.forEach(({ sku, error }) => {
      console.log(`  - ${sku}: ${error}`)
    })
  }

  if (failedCount === 0) {
    console.log('\n✅ All inventory items now have catalog entries!')
  } else {
    console.log(`\n⚠️  ${failedCount} SKU(s) failed - these may need manual review`)
  }
}

// ============================================================================
// Auto-Heal Function (simplified from src/lib/catalog/ensure.ts)
// ============================================================================

async function ensureProductInCatalogForSku(sku) {
  // Check if exists (redundant but safe)
  const { data: existing } = await supabase
    .from('product_catalog')
    .select('sku')
    .eq('sku', sku)
    .maybeSingle()

  if (existing) {
    return { success: true, catalogItemSku: existing.sku, created: false, source: 'existing' }
  }

  // Try StockX search
  const stockxResult = await searchAndCreateFromStockX(sku)
  if (stockxResult.success) return stockxResult

  // Try Alias search (if needed)
  // const aliasResult = await searchAndCreateFromAlias(sku)
  // if (aliasResult.success) return aliasResult

  // Create minimal entry
  return await createMinimalCatalogEntry(sku)
}

async function searchAndCreateFromStockX(sku) {
  try {
    // Simple StockX search using public API (no OAuth required)
    const url = `https://api.stockx.com/v2/search?query=${encodeURIComponent(sku)}`

    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
    })

    if (!response.ok) {
      return { success: false, created: false, error: `StockX API error: ${response.status}` }
    }

    const data = await response.json()

    if (!data.products || data.products.length === 0) {
      return { success: false, created: false, error: 'No StockX results' }
    }

    const product = data.products[0]

    const { data: newCatalog, error: insertError } = await supabase
      .from('product_catalog')
      .insert({
        sku: sku,
        brand: product.brand || 'Unknown',
        model: product.title || product.name || 'Unknown Model',
        colorway: product.colorway || null,
        image_url: product.media?.imageUrl || product.thumbnail || null,
        retail_price: product.retailPrice || null,
        retail_currency: 'USD',
        release_date: product.releaseDate || null,
      })
      .select('sku')
      .single()

    if (insertError) {
      return { success: false, created: false, error: `Insert failed: ${insertError.message}` }
    }

    return {
      success: true,
      catalogItemSku: newCatalog.sku,
      created: true,
      source: 'stockx',
    }
  } catch (error) {
    return { success: false, created: false, error: error.message }
  }
}

async function createMinimalCatalogEntry(sku) {
  try {
    const skuParts = sku.split(/[\s-]+/)
    const potentialBrand = skuParts[0] || 'Unknown'

    const { data: newCatalog, error: insertError } = await supabase
      .from('product_catalog')
      .insert({
        sku: sku,
        brand: potentialBrand,
        model: `Product ${sku}`,
        colorway: null,
        image_url: null,
        retail_price: null,
        retail_currency: 'USD',
        release_date: null,
      })
      .select('sku')
      .single()

    if (insertError) {
      return { success: false, created: false, error: `Failed to create minimal entry: ${insertError.message}` }
    }

    return {
      success: true,
      catalogItemSku: newCatalog.sku,
      created: true,
      source: 'minimal',
    }
  } catch (error) {
    return { success: false, created: false, error: error.message }
  }
}

// ============================================================================
// Run
// ============================================================================

backfillCatalog()
  .then(() => {
    console.log('\n✅ Backfill complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  })
