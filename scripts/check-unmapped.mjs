#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Find products without ANY catalog mapping
const { data: unmapped } = await supabase
  .from('products')
  .select(`
    sku,
    brand,
    model,
    product_variants!inner (
      alias_catalog_id,
      stockx_product_id
    )
  `)
  .is('product_variants.alias_catalog_id', null)
  .is('product_variants.stockx_product_id', null)

// Get unique SKUs
const uniqueUnmapped = [...new Set(unmapped?.map(p => p.sku) || [])]

console.log(`📋 Unmapped products (${uniqueUnmapped.length}):`)
uniqueUnmapped.forEach(sku => {
  console.log(`  ${sku}`)
})
