#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 Sync Status Report\n')

// Total products
const { count: totalProducts } = await supabase
  .from('products')
  .select('*', { count: 'exact', head: true })

// Products with Alias catalog IDs
const { data: aliasProducts } = await supabase
  .from('products')
  .select(`
    id,
    sku,
    brand,
    model,
    product_variants!inner(alias_catalog_id)
  `)
  .not('product_variants.alias_catalog_id', 'is', null)

const uniqueAliasProducts = [...new Set(aliasProducts?.map(p => p.sku) || [])]

console.log(`Products seeded: ${totalProducts}`)
console.log(`Products with Alias catalog IDs: ${uniqueAliasProducts.length}`)
console.log(`Products without Alias IDs: ${totalProducts - uniqueAliasProducts.length}\n`)

console.log('✅ Products ready to sync:')
uniqueAliasProducts.slice(0, 10).forEach(sku => {
  const p = aliasProducts.find(p => p.sku === sku)
  console.log(`  ${p.sku} - ${p.brand} ${p.model}`)
})

console.log(`\n📈 Next steps:`)
console.log(`  1. Run market data sync to fetch pricing for ${uniqueAliasProducts.length} products`)
console.log(`  2. Remaining ${totalProducts - uniqueAliasProducts.length} products need catalog mapping`)
console.log(`  3. StockX sync is not implemented yet (marked as TODO)\n`)
