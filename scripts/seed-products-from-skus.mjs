#!/usr/bin/env node
/**
 * Seed products from SKU list
 * Maps to existing catalog items where possible
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// SKU list from user (duplicates removed)
const SKUS = [
  'U9060BPM',
  'CT8013-117',
  'IB4171-100',
  'FV5029-200',
  'FV5029-010',
  '1201A906-001',
  'CT8012-047',
  'IB4171-010',
  '378038-047',
  'FV5029-100',
  '1201B020-100',
  'HQ6448',
  'M2002RDA',
  '1203A537-110',
  'CT8532-111',
  'II1493-600',
  'JI2734',
  'CU9225-100',
  'CU9225-102',
  'CU9225-002',
  'CU9225-200',
  'CU9225-001',
  'DD1391-103',
  'DD1503-103',
  'DD1503-124',
  'FQ3545-300',
  'FQ3544-100',
  'HF8022-300',
  'FQ1180-001',
  'FZ1291-600',
  'HF6061-400',
  'BQ6817-600',
  'DD1503-118',
  'IQ4035-100',
  'FZ8784-001',
  'HJ4320-001',
  'IM7410-001',
  'HM4740-101',
  'HM4740-005',
  'HM4740-001',
  'CW1590-100',
  'DR5415-100',
  'IH0296-400',
  'M2002RDB',
  'DX0755-001',
  'HF7743-001',
  'FD2562-400',
  'CT2552-800',
  'FN7509-029',
  'HQ8492-400',
  'HF7545-100',
  'DQ9001-001',
  'HM0622-003',
  'HQ6998-600',
  'IH2309-500',
  'FV5104-006',
  'FQ8138-002',
  'DZ5485-008',
  'DM7866-104',
  'DM7866-140',
  'CQ4277-001',
  'DZ4137-106',
  'DN3707-010',
  'IB1519-200',
  'IF4491-100',
  'DM7866-202',
  'FV5121-006',
  'HQ7978-100',
  'IO3372-700',
  'DN3707-202',
  'DZ4137-700',
  'DD1870-100',
  'IM3906-100',
  'HF1012-300',
  'DO9392-701',
  'CN2405-900',
  'AQ4211-101',
  'DO9392-700',
  'DO9549-001',
  'DN1803-300',
  'DN1803-900',
  'HF8813-500',
  'HF8813-001',
  'HF8813-100',
  'HF8813-700',
  'DO9392-200',
  'DQ3989-100',
  'DH1348-001',
  'AJ4219-400',
  'DQ8475-001',
  'DQ8475-800',
  'DD1870-600',
  'HF2903-100',
  'HV5776-200',
  'FB2709-003',
  'II7404-400',
  'II7404-100',
  'HM4743-001',
  'HM4743-100',
  'HF5515-400',
  'HM4743-400',
  'IM6039-001',
  'IO4642-001',
  'IO4643-001',
  'IO4643-200',
  'IM6039-200',
  'FZ8743-200',
  'FZ8743-201',
  'IB4453-100',
  'FB2709-002',
  'FB2709-001',
  'IB4453-001',
]

console.log(`📦 Seeding ${SKUS.length} products from SKU list...\n`)

async function seedFromSKUs() {
  let created = 0
  let foundInCatalog = 0
  let skipped = 0
  let errors = 0

  for (const sku of SKUS) {
    try {
      console.log(`Processing: ${sku}`)

      // Check if already exists in products table
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku)
        .maybeSingle()

      if (existing) {
        console.log(`  ⏭️  Already exists`)
        skipped++
        continue
      }

      // Try to find in alias_catalog_items
      const { data: aliasCatalog } = await supabase
        .from('alias_catalog_items')
        .select('*')
        .eq('sku', sku.toUpperCase().replace(/[-\s]/g, ' '))
        .maybeSingle()

      // Try to find in stockx_products
      const { data: stockxCatalog } = await supabase
        .from('stockx_products')
        .select('*')
        .eq('style_id', sku.toUpperCase().replace(/[-\s]/g, ' '))
        .maybeSingle()

      let productData = {
        sku: sku,
        brand: null,
        model: null,
        colorway: null,
        category: 'sneakers',
        tier: 'warm',
        popularity_score: 50,
        image_url: null,
      }

      if (aliasCatalog) {
        console.log(`  ✓ Found in Alias catalog`)
        productData.brand = aliasCatalog.brand || 'Unknown'
        productData.model = aliasCatalog.model || sku
        productData.colorway = aliasCatalog.colorway
        productData.image_url = aliasCatalog.image_url
        foundInCatalog++
      } else if (stockxCatalog) {
        console.log(`  ✓ Found in StockX catalog`)
        productData.brand = stockxCatalog.brand || 'Unknown'
        productData.model = stockxCatalog.title || sku
        productData.image_url = stockxCatalog.image_url
        foundInCatalog++
      } else {
        console.log(`  ⚠️  Not in catalog - using SKU only`)
        productData.brand = 'Unknown'
        productData.model = sku
      }

      // Insert product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()

      if (productError) {
        console.log(`  ❌ Error: ${productError.message}`)
        errors++
        continue
      }

      console.log(`  ✅ Created product: ${product.id}`)

      // Create size variants (US 3.5-18)
      const sizes = []
      for (let size = 3.5; size <= 18; size += 0.5) {
        sizes.push({
          product_id: product.id,
          size_key: size.toString(),
          size_numeric: size,
          size_system: 'US',
          alias_catalog_id: aliasCatalog?.catalog_id || null,
          stockx_product_id: stockxCatalog?.stockx_product_id || null,
        })
      }

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(sizes)

      if (variantsError) {
        console.log(`  ⚠️  Variants error: ${variantsError.message}`)
      } else {
        console.log(`  ✅ Created ${sizes.length} variants`)
      }

      created++

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SEEDING COMPLETE')
  console.log('='.repeat(80))
  console.log(`✅ Created: ${created}`)
  console.log(`📚 Found in catalog: ${foundInCatalog}`)
  console.log(`⏭️  Skipped (existing): ${skipped}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📦 Total SKUs: ${SKUS.length}`)
  console.log('\n')
}

seedFromSKUs().catch(console.error)
