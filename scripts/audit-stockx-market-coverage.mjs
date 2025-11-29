// ============================================================================
// READ-ONLY AUDIT SCRIPT - MULTI-TENANT AWARE
// ============================================================================
//
// This script MUST NOT perform any inserts, updates, deletes, or API calls.
// It only prints out where StockX data is missing (variants / market snapshots).
//
// Purpose:
// - If USER_ID provided: Show missing data for products THIS USER owns
// - Always show global catalog coverage (informational, not errors)
// - Pre-seeded products act as warm cache for future users (not errors)
//
// Usage:
//   node scripts/audit-stockx-market-coverage.mjs [USER_ID]
//
// Examples:
//   node scripts/audit-stockx-market-coverage.mjs                    # Global catalog coverage only
//   node scripts/audit-stockx-market-coverage.mjs abc-123-def-456    # User-specific audit
//
// ============================================================================

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

// Get userId from command line args (optional)
const userId = process.argv[2] || null

// ============================================================================
// Audit Function
// ============================================================================

async function auditStockxCoverage() {
  console.log('📊 StockX Market Data Coverage Audit')
  console.log('=' .repeat(80))
  console.log('READ-ONLY - No data will be modified')
  console.log('')

  if (userId) {
    console.log(`🔍 User-specific audit for: ${userId}`)
    console.log('')
  } else {
    console.log('ℹ️  Global catalog coverage only (no user-specific audit)')
    console.log('   To audit a specific user, run: node scripts/audit-stockx-market-coverage.mjs USER_ID')
    console.log('')
  }

  const globalStats = {
    totalProducts: 0,
    noVariants: 0,
    variantsButNoSnapshots: 0,
    fullyPopulated: 0,
  }

  const userStats = {
    totalProducts: 0,
    noVariants: 0,
    variantsButNoSnapshots: 0,
    fullyPopulated: 0,
  }

  const problemProducts = {
    noVariants: [],
    variantsButNoSnapshots: [],
  }

  try {
    // ========================================================================
    // Step 1: If userId provided, fetch their inventory products
    // ========================================================================

    let userProductIds = new Set()

    if (userId) {
      console.log('📦 Fetching user inventory...')

      // Get all inventory items for this user
      const { data: inventory, error: inventoryError } = await supabase
        .from('Inventory')
        .select('id, sku, brand, model')
        .eq('user_id', userId)
        .in('status', ['active', 'listed', 'worn'])

      if (inventoryError) {
        throw new Error(`Failed to fetch user inventory: ${inventoryError.message}`)
      }

      console.log(`Found ${inventory.length} inventory items for user`)

      // Get stockx_product_id for each inventory item via inventory_market_links
      const { data: links, error: linksError } = await supabase
        .from('inventory_market_links')
        .select('item_id, stockx_product_id')
        .in('item_id', inventory.map(i => i.id))
        .not('stockx_product_id', 'is', null)

      if (linksError) {
        throw new Error(`Failed to fetch market links: ${linksError.message}`)
      }

      userProductIds = new Set(links.map(l => l.stockx_product_id))
      console.log(`User has ${userProductIds.size} unique StockX products in inventory`)
      console.log('')
    }

    // ========================================================================
    // Step 2: Fetch all products with StockX IDs (global catalog)
    // ========================================================================

    console.log('🔍 Fetching global StockX product catalog...')
    const { data: products, error: productsError } = await supabase
      .from('stockx_products')
      .select('id, stockx_product_id, style_id, brand, title')
      .not('stockx_product_id', 'is', null)
      .order('created_at', { ascending: false })

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    console.log(`Found ${products.length} products in global stockx_products catalog`)
    console.log('')
    globalStats.totalProducts = products.length

    // ========================================================================
    // Step 3: Analyze each product
    // ========================================================================

    console.log('📋 Analyzing StockX data coverage...')
    console.log('')

    for (const product of products) {
      const isUserProduct = userProductIds.has(product.stockx_product_id)

      // Count variants for this product
      const { count: variantCount, error: variantError } = await supabase
        .from('stockx_variants')
        .select('*', { count: 'exact', head: true })
        .eq('stockx_product_id', product.stockx_product_id)

      if (variantError) {
        console.error(`⚠️  Error counting variants for ${product.style_id}:`, variantError.message)
        continue
      }

      // Count market snapshots (GBP) for this product
      const { count: snapshotCount, error: snapshotError } = await supabase
        .from('stockx_market_latest')
        .select('*', { count: 'exact', head: true })
        .eq('stockx_product_id', product.stockx_product_id)
        .eq('currency_code', 'GBP')

      if (snapshotError) {
        console.error(`⚠️  Error counting snapshots for ${product.style_id}:`, snapshotError.message)
        continue
      }

      const variants = variantCount || 0
      const snapshots = snapshotCount || 0

      // Track global stats (all products)
      if (variants === 0) {
        globalStats.noVariants++
      } else if (snapshots === 0) {
        globalStats.variantsButNoSnapshots++
      } else {
        globalStats.fullyPopulated++
      }

      // Track user-specific stats and problems (only if this is user's product)
      if (isUserProduct) {
        userStats.totalProducts++

        if (variants === 0) {
          userStats.noVariants++
          problemProducts.noVariants.push({
            id: product.id,
            sku: product.style_id,
            brand: product.brand,
            name: product.title,
            stockxProductId: product.stockx_product_id,
            variants,
            snapshots,
          })
        } else if (snapshots === 0) {
          userStats.variantsButNoSnapshots++
          problemProducts.variantsButNoSnapshots.push({
            id: product.id,
            sku: product.style_id,
            brand: product.brand,
            name: product.title,
            stockxProductId: product.stockx_product_id,
            variants,
            snapshots,
          })
        } else {
          userStats.fullyPopulated++
        }
      }
    }

    // ========================================================================
    // Step 4: Print Summary
    // ========================================================================

    console.log('')
    console.log('=' .repeat(80))
    console.log('📊 GLOBAL CATALOG COVERAGE (Informational)')
    console.log('=' .repeat(80))
    console.log('')
    console.log('Pre-seeded products act as warm cache for future users.')
    console.log('These are NOT errors - just showing current catalog state.')
    console.log('')
    console.log(`Total products in stockx_products catalog:           ${globalStats.totalProducts}`)
    console.log(`  Products with 0 variants:                          ${globalStats.noVariants}`)
    console.log(`  Products with variants but 0 snapshots (GBP):      ${globalStats.variantsButNoSnapshots}`)
    console.log(`  Products fully populated (variants + snapshots):   ${globalStats.fullyPopulated}`)
    console.log('')

    // User-specific summary (only if userId provided)
    if (userId) {
      console.log('=' .repeat(80))
      console.log('👤 USER-SPECIFIC ISSUES (Action Required)')
      console.log('=' .repeat(80))
      console.log('')
      console.log(`User ID: ${userId}`)
      console.log(`Total StockX products in user's inventory:          ${userStats.totalProducts}`)
      console.log(`  ❌ User's products with 0 variants:                 ${userStats.noVariants}`)
      console.log(`  ⚠️  User's products with variants but 0 snapshots:  ${userStats.variantsButNoSnapshots}`)
      console.log(`  ✅ User's products fully populated:                 ${userStats.fullyPopulated}`)
      console.log('')
    }

    // ========================================================================
    // Step 5: Print Problem Products (User-Specific Only)
    // ========================================================================

    if (userId) {
      if (problemProducts.noVariants.length > 0) {
        console.log('=' .repeat(80))
        console.log(`❌ USER'S PRODUCTS WITH 0 VARIANTS (${problemProducts.noVariants.length})`)
        console.log('=' .repeat(80))
        console.log('')
        console.log('These products are in YOUR inventory but have no size variants cached.')
        console.log('Action needed: Run "Sync StockX Data" button on Market Page')
        console.log('')

        console.table(
          problemProducts.noVariants.map(p => ({
            SKU: p.sku,
            Brand: p.brand || '—',
            Name: p.name?.substring(0, 40) || '—',
            'StockX Product ID': p.stockxProductId,
            Variants: p.variants,
            Snapshots: p.snapshots,
          }))
        )
        console.log('')
      }

      if (problemProducts.variantsButNoSnapshots.length > 0) {
        console.log('=' .repeat(80))
        console.log(`⚠️  USER'S PRODUCTS WITH VARIANTS BUT NO SNAPSHOTS (${problemProducts.variantsButNoSnapshots.length})`)
        console.log('=' .repeat(80))
        console.log('')
        console.log('These products are in YOUR inventory with size variants but no market data (GBP).')
        console.log('Action needed: Run "Sync StockX Data" button on Market Page')
        console.log('')

        console.table(
          problemProducts.variantsButNoSnapshots.map(p => ({
            SKU: p.sku,
            Brand: p.brand || '—',
            Name: p.name?.substring(0, 40) || '—',
            'StockX Product ID': p.stockxProductId,
            Variants: p.variants,
            Snapshots: p.snapshots,
          }))
        )
        console.log('')
      }

      if (userStats.fullyPopulated === userStats.totalProducts && userStats.totalProducts > 0) {
        console.log('=' .repeat(80))
        console.log('✅ ALL YOUR PRODUCTS FULLY POPULATED')
        console.log('=' .repeat(80))
        console.log('')
        console.log('All products in your inventory have both variants and market snapshots.')
        console.log('No action needed!')
        console.log('')
      }
    }

    // ========================================================================
    // Step 6: Print Recommendations
    // ========================================================================

    console.log('=' .repeat(80))
    console.log('💡 RECOMMENDATIONS')
    console.log('=' .repeat(80))
    console.log('')

    if (userId) {
      if (userStats.noVariants > 0 || userStats.variantsButNoSnapshots > 0) {
        console.log('To fix YOUR incomplete products:')
        console.log('')
        console.log('Option 1: Manual sync per product (recommended)')
        console.log('  1. Navigate to Market page for the product')
        console.log('  2. Click "Sync StockX Data" button')
        console.log('  3. Wait for sync to complete')
        console.log('')
      }

      console.log('To re-run this user-specific audit:')
      console.log(`  node scripts/audit-stockx-market-coverage.mjs ${userId}`)
      console.log('')
    } else {
      console.log('Global catalog coverage shown above is informational only.')
      console.log('Pre-seeded products (like M2002RDA, DD1391-100) act as warm cache.')
      console.log('')
      console.log('To audit a specific user\'s inventory:')
      console.log('  node scripts/audit-stockx-market-coverage.mjs USER_ID')
      console.log('')
      console.log('To see global coverage again:')
      console.log('  node scripts/audit-stockx-market-coverage.mjs')
      console.log('')
    }

  } catch (error) {
    console.error('')
    console.error('❌ Fatal error:', error.message)
    console.error('')
    process.exit(1)
  }
}

// ============================================================================
// Run
// ============================================================================

auditStockxCoverage().catch(console.error)
