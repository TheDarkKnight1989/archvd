#!/usr/bin/env node
/**
 * Backfill StockX Catalog Tables
 *
 * Populates stockx_products and stockx_variants for all existing mappings in inventory_market_links
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔄 Starting StockX Catalog Backfill...\n')

// Get user credentials for API authentication
console.log('1️⃣  Getting StockX account for authentication...')
const { data: stockxAccounts, error: accountsError } = await supabase
  .from('stockx_accounts')
  .select('user_id, expires_at')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single()

if (accountsError || !stockxAccounts) {
  console.error('❌ No StockX account found:', accountsError?.message)
  process.exit(1)
}

const userId = stockxAccounts.user_id
console.log(`✅ Using user: ${userId}`)

// Query distinct product IDs from inventory_market_links
console.log('\n2️⃣  Querying inventory_market_links...')
const { data: links, error: linksError } = await supabase
  .from('inventory_market_links')
  .select('stockx_product_id')
  .not('stockx_product_id', 'is', null)

if (linksError) {
  console.error('❌ Failed to query links:', linksError.message)
  process.exit(1)
}

// Get distinct product IDs
const distinctProductIds = Array.from(new Set(links.map(l => l.stockx_product_id)))
  .filter(id => id && id !== 'test') // Filter out test/invalid IDs

console.log(`✅ Found ${distinctProductIds.length} distinct product IDs`)

let insertedProducts = 0
let insertedVariants = 0
let skippedExisting = 0
let errors = 0

console.log('\n3️⃣  Hydrating catalog from StockX API...\n')

// Dynamic import of the hydration helper
const { upsertStockxCatalogFromApi } = await import('../src/lib/services/stockx/catalog.ts')

for (const productId of distinctProductIds) {
  // Check if product already exists
  const { data: existing } = await supabase
    .from('stockx_products')
    .select('id')
    .eq('stockx_product_id', productId)
    .maybeSingle()

  if (existing) {
    console.log(`⏭️  Product ${productId} already exists, skipping`)
    skippedExisting++
    continue
  }

  try {
    console.log(`🔄 Hydrating ${productId}...`)

    const result = await upsertStockxCatalogFromApi({
      productId,
      userId,
    })

    if (result.productUuid) {
      insertedProducts++

      // Count how many variants were inserted
      const { count } = await supabase
        .from('stockx_variants')
        .select('*', { count: 'exact', head: true })
        .eq('stockx_product_id', productId)

      insertedVariants += count || 0

      console.log(`✅ Product hydrated: ${insertedProducts}/${distinctProductIds.length} (${count || 0} variants)`)
    } else {
      console.error(`❌ Failed to hydrate ${productId}`)
      errors++
    }

    // Rate limit: 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  } catch (error) {
    console.error(`❌ Error hydrating ${productId}:`, error.message)
    errors++
  }
}

console.log('\n4️⃣  Verifying final counts...')
const { count: productsCount } = await supabase
  .from('stockx_products')
  .select('*', { count: 'exact', head: true })

const { count: variantsCount } = await supabase
  .from('stockx_variants')
  .select('*', { count: 'exact', head: true })

console.log(`\n📊 Backfill Summary:`)
console.log(`   Distinct product IDs: ${distinctProductIds.length}`)
console.log(`   Products inserted: ${insertedProducts}`)
console.log(`   Products skipped (existing): ${skippedExisting}`)
console.log(`   Variants inserted: ${insertedVariants}`)
console.log(`   Errors: ${errors}`)
console.log(`\n   Total products in DB: ${productsCount}`)
console.log(`   Total variants in DB: ${variantsCount}`)

if (errors > 0) {
  console.log('\n⚠️  Backfill completed with errors')
  process.exit(1)
} else {
  console.log('\n✅ Backfill completed successfully!')
  process.exit(0)
}
