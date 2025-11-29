#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Simulate what happens when user clicks on the Dunk Low item
console.log('=== Simulating Market Page Lookup ===\n')

// 1. User clicks on inventory item, generating a slug
const inventoryBrand = 'Nike'
const inventoryModel = 'Nike Dunk Low'
const sku = 'DD1503-124'

function generateProductSlug(productName, sku) {
  const slugify = (text) => text
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slugify(productName)}-${slugify(sku)}`
}

const productName = `${inventoryBrand} ${inventoryModel}`.trim()
const generatedSlug = generateProductSlug(productName, sku)

console.log('1. Inventory Item:')
console.log(`   Brand: ${inventoryBrand}`)
console.log(`   Model: ${inventoryModel}`)
console.log(`   SKU: ${sku}`)
console.log(`   Generated Slug: ${generatedSlug}`)
console.log()

// 2. Try to find by slug
console.log('2. Looking up by slug...')
const { data: bySlug, error: slugError } = await supabase
  .from('alias_catalog_items')
  .select('*')
  .eq('slug', generatedSlug)
  .maybeSingle()

if (bySlug) {
  console.log(`   ✅ Found by slug: ${bySlug.product_name}`)
} else {
  console.log(`   ❌ Not found by slug`)
}
console.log()

// 3. Fallback to SKU lookup
console.log('3. Falling back to SKU lookup...')

function parseSkuFromSlug(slug) {
  const parts = slug.toLowerCase().split('-')
  for (let i = 1; i <= Math.min(2, parts.length); i++) {
    const candidate = parts.slice(-i).join('-')
    const hasLetter = /[a-z]/.test(candidate)
    const hasNumber = /[0-9]/.test(candidate)
    const validLength = candidate.length >= 3 && candidate.length <= 20

    if (!hasLetter || !hasNumber || !validLength) continue

    const firstPart = parts[parts.length - i]
    const firstHasLetter = /[a-z]/.test(firstPart)
    const firstHasNumber = /[0-9]/.test(firstPart)

    if (firstHasLetter && firstHasNumber) {
      return candidate
    }
  }
  return null
}

const parsedSku = parseSkuFromSlug(generatedSlug)
console.log(`   Parsed SKU from slug: ${parsedSku}`)

if (parsedSku) {
  const normalizedSku = parsedSku.replace(/[-\s]/g, '').toLowerCase()
  console.log(`   Normalized: ${normalizedSku}`)

  // Get all catalog items
  const { data: allCatalog } = await supabase
    .from('alias_catalog_items')
    .select('*')

  const catalogBySku = allCatalog?.find((item) => {
    const itemSku = (item.sku || '').replace(/[-\s]/g, '').toLowerCase()
    return itemSku === normalizedSku
  })

  if (catalogBySku) {
    console.log(`   ✅ Found by SKU: ${catalogBySku.product_name}`)
    console.log(`      Catalog SKU: ${catalogBySku.sku}`)
    console.log(`      Catalog Slug: ${catalogBySku.slug}`)
  } else {
    console.log(`   ❌ Not found by SKU`)
  }
}

console.log()
console.log('=== Test Complete ===')
