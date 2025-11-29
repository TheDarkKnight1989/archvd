#!/usr/bin/env node

/**
 * Test the singular /availability endpoint with exact parameters
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pat = process.env.ALIAS_PAT
const catalogId = 'air-jordan-1-retro-high-og-dz5485-612'
const usSize = 11

console.log('\n=== TESTING SINGULAR ENDPOINT ===\n')
console.log('Catalog ID:', catalogId)
console.log('Size:', usSize, 'US')
console.log('Product Condition: PRODUCT_CONDITION_NEW')
console.log('Packaging Condition: PACKAGING_CONDITION_GOOD_CONDITION')
console.log()

const params = new URLSearchParams({
  catalog_id: catalogId,
  size: usSize.toString(),
  product_condition: 'PRODUCT_CONDITION_NEW',
  packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
  consigned: 'false',
  // region_id omitted - API doesn't accept empty string
})

const url = `https://api.alias.org/api/v1/pricing_insights/availability?${params}`

console.log('Request URL:', url)
console.log()

const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json',
  },
})

console.log('Response Status:', response.status)
console.log()

if (!response.ok) {
  const text = await response.text()
  console.error('ERROR:', text)
  process.exit(1)
}

const data = await response.json()

console.log('=== RESPONSE ===\n')
console.log(JSON.stringify(data, null, 2))
console.log()

if (data.availability) {
  const avail = data.availability
  console.log('=== PARSED VALUES ===\n')
  console.log('Lowest Ask:', avail.lowest_listing_price_cents, `→ $${parseInt(avail.lowest_listing_price_cents || 0) / 100}`)
  console.log('Highest Bid:', avail.highest_offer_price_cents, `→ $${parseInt(avail.highest_offer_price_cents || 0) / 100}`)
  console.log('Last Sold:', avail.last_sold_listing_price_cents, `→ $${parseInt(avail.last_sold_listing_price_cents || 0) / 100}`)
  console.log('Global Indicator:', avail.global_indicator_price_cents, `→ $${parseInt(avail.global_indicator_price_cents || 0) / 100}`)
  console.log()
  console.log('✅ These are the exact NEW + GOOD_CONDITION values')
}
