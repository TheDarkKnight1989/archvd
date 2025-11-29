#!/usr/bin/env node
/**
 * Test Alias listing flow step-by-step
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const ALIAS_PAT = process.env.ALIAS_PAT
if (!ALIAS_PAT) {
  console.error('❌ ALIAS_PAT not found')
  process.exit(1)
}

const BASE_URL = 'https://api.alias.org/api/v1'

// Test data
const SKU = 'DH3227-105'
const PRODUCT_NAME = 'Jordan Air Jordan 1 Retro Low OG SP Fragment x Travis Scott Sail Military Blue'
const BRAND = 'Jordan'

console.log('🧪 ALIAS LISTING FLOW - STEP BY STEP\n')
console.log('='  .repeat(60))
console.log(`SKU: ${SKU}`)
console.log(`Product: ${PRODUCT_NAME}`)
console.log(`Brand: ${BRAND}`)
console.log('=' .repeat(60))

// STEP 1: Search catalog for matching item
console.log('\n📍 STEP 1: Search Alias Catalog by SKU\n')

const searchUrl = `${BASE_URL}/catalog?query=${encodeURIComponent(SKU)}`

console.log(`Request:`)
console.log(`  GET ${searchUrl}`)
console.log(`  Authorization: Bearer {ALIAS_PAT}`)
console.log()

try {
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
    },
  })

  console.log(`Response Status: ${response.status} ${response.statusText}`)

  const data = await response.json()

  if (response.ok) {
    console.log(`\n✅ Success!`)
    console.log(`Found ${data.items?.length || 0} items\n`)

    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      console.log(`First Match:`)
      console.log(`  Catalog ID: ${item.id}`)
      console.log(`  Name: ${item.name}`)
      console.log(`  SKU: ${item.sku}`)
      console.log(`  Brand: ${item.brand}`)
      console.log()

      // Store for next step
      console.log(`\n📝 Catalog ID for next step: ${item.id}`)
    } else {
      console.log(`❌ No items found for SKU: ${SKU}`)
    }
  } else {
    console.log(`\n❌ Error:`)
    console.log(JSON.stringify(data, null, 2))
  }

} catch (error) {
  console.error('❌ Request failed:', error.message)
}

console.log('\n' + '='.repeat(60))
console.log('⏸️  Ready for next step? Type "next" to continue...')
