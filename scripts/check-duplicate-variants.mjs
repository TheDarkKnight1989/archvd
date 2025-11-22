#!/usr/bin/env node
/**
 * PHASE 3.7: Check for duplicate variants in stockx_variants table
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🔍 Checking for duplicate variants...\n')

// Check Chicago Low variant specifically
const chicagoVariantId = '5c9c0e3c-0c64-4540-94ac-2c2dbdf87754'

const { data: chicagoVariants, error } = await supabase
  .from('stockx_variants')
  .select('id, stockx_variant_id, stockx_product_id, variant_value, created_at')
  .eq('stockx_variant_id', chicagoVariantId)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`Chicago Low variant (${chicagoVariantId}):`)
console.log(`Found ${chicagoVariants.length} row(s)\n`)

if (chicagoVariants.length > 0) {
  chicagoVariants.forEach((v, i) => {
    console.log(`  [${i + 1}]:`)
    console.log(`    UUID: ${v.id}`)
    console.log(`    Product ID: ${v.stockx_product_id}`)
    console.log(`    Variant Value: ${v.variant_value}`)
    console.log(`    Created: ${v.created_at}`)
    console.log()
  })
}

// Check for all duplicates
const { data: allVariants } = await supabase
  .from('stockx_variants')
  .select('stockx_variant_id, id, created_at')
  .order('stockx_variant_id')

const duplicateMap = new Map()

allVariants.forEach(v => {
  if (!duplicateMap.has(v.stockx_variant_id)) {
    duplicateMap.set(v.stockx_variant_id, [])
  }
  duplicateMap.get(v.stockx_variant_id).push(v)
})

const duplicates = Array.from(duplicateMap.entries())
  .filter(([_, variants]) => variants.length > 1)

console.log('=' .repeat(70))
console.log(`📊 Total duplicate variants found: ${duplicates.length}`)
console.log('='.repeat(70))

if (duplicates.length > 0) {
  console.log('\nDuplicates:')
  duplicates.slice(0, 10).forEach(([variantId, variants]) => {
    console.log(`\n  ${variantId}: ${variants.length} copies`)
    variants.forEach((v, i) => {
      console.log(`    [${i + 1}] UUID: ${v.id}, Created: ${v.created_at}`)
    })
  })

  if (duplicates.length > 10) {
    console.log(`\n  ... and ${duplicates.length - 10} more`)
  }
}
