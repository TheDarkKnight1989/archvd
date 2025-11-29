#!/usr/bin/env node
/**
 * Debug size matching for a specific product
 * Usage: node scripts/debug-size-matching.mjs <SKU> <size> <sizeSystem>
 * Example: node scripts/debug-size-matching.mjs DZ5485-410 10 UK
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

const sku = process.argv[2]
const size = process.argv[3]
const sizeSystem = process.argv[4]

if (!sku || !size || !sizeSystem) {
  console.log('Usage: node scripts/debug-size-matching.mjs <SKU> <size> <sizeSystem>')
  console.log('Example: node scripts/debug-size-matching.mjs DZ5485-410 10 UK')
  process.exit(1)
}

async function debugSizeMatching() {
  console.log('🔍 Debugging size matching...')
  console.log(`SKU: ${sku}`)
  console.log(`Size: ${size} ${sizeSystem}\n`)

  // 1. Check if product exists in catalog
  const { data: catalogData, error: catalogError } = await supabase
    .from('product_catalog')
    .select('*')
    .eq('sku', sku)
    .single()

  if (catalogError || !catalogData) {
    console.log('❌ Product not found in catalog')
    console.log('Error:', catalogError?.message)
    return
  }

  console.log('✅ Product found in catalog:')
  console.log(`   Brand: ${catalogData.brand}`)
  console.log(`   Model: ${catalogData.model}`)
  console.log(`   StockX ID: ${catalogData.stockx_product_id}\n`)

  // 2. Check variants
  if (!catalogData.stockx_product_id) {
    console.log('❌ No StockX product ID - cannot fetch variants')
    return
  }

  const { data: variantsData, error: variantsError } = await supabase
    .from('stockx_variants')
    .select('*')
    .eq('stockx_product_id', catalogData.stockx_product_id)
    .order('variant_value', { ascending: true })

  if (variantsError || !variantsData || variantsData.length === 0) {
    console.log('❌ No variants found')
    console.log('Error:', variantsError?.message)
    return
  }

  console.log(`✅ Found ${variantsData.length} variants:\n`)
  variantsData.forEach((v, i) => {
    console.log(`   ${i + 1}. ${v.size_display} (variantValue: ${v.variant_value})`)
  })

  console.log(`\n🔍 Looking for size ${size} ${sizeSystem}...`)
  console.log(`\n📋 Available sizes (as stored in DB):`)
  const availableSizes = variantsData.map(v => v.variant_value).filter(Boolean)
  console.log(`   ${availableSizes.join(', ')}`)

  console.log(`\n💡 The issue might be:`)
  console.log(`   1. Size ${size} ${sizeSystem} doesn't exist for this product`)
  console.log(`   2. Size conversion logic needs adjustment`)
  console.log(`   3. StockX uses different size format than expected`)
}

debugSizeMatching()
