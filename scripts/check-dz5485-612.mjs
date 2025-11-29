#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pat = process.env.ALIAS_PAT
const sku = 'DZ5485-612'

console.log('\n=== ALIAS API REQUEST: SEARCH BY SKU ===\n')
console.log('SKU:', sku)
console.log('Request URL:', `https://api.alias.org/api/v1/catalog?query=${encodeURIComponent(sku)}`)
console.log('Headers:', {
  'Authorization': `Bearer ${pat?.substring(0, 12)}...`,
  'Content-Type': 'application/json',
})
console.log()

// Step 1: Search for catalog by SKU
const searchResponse = await fetch(`https://api.alias.org/api/v1/catalog?query=${encodeURIComponent(sku)}`, {
  headers: {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json',
  },
})

const searchData = await searchResponse.json()

console.log('=== SEARCH RESPONSE ===\n')
console.log('Status:', searchResponse.status)
console.log('Response:', JSON.stringify(searchData, null, 2))
console.log()

if (!searchData.catalog_items || searchData.catalog_items.length === 0) {
  console.error('❌ No catalog items found for SKU:', sku)
  process.exit(1)
}

const catalogId = searchData.catalog_items[0].catalog_id
console.log('✅ Found catalog ID:', catalogId)
console.log()

// Step 2: Get pricing data
console.log('=== ALIAS API REQUEST: PRICING DATA ===\n')
console.log('Catalog ID:', catalogId)
console.log('Request URL:', `https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`)
console.log('Headers:', {
  'Authorization': `Bearer ${pat?.substring(0, 12)}...`,
  'Content-Type': 'application/json',
})
console.log()

const pricingResponse = await fetch(`https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`, {
  headers: {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json',
  },
})

const pricingData = await pricingResponse.json()

console.log('=== PRICING RESPONSE ===\n')
console.log('Status:', pricingResponse.status)
console.log('Total variants:', pricingData.variants?.length || 0)
console.log()

// Find US 10 variants
const usSize10 = 10
console.log(`=== FILTERING FOR US SIZE ${usSize10} ===\n`)

const size10Variants = pricingData.variants.filter(v => v.size === usSize10 && v.availability)

if (size10Variants.length === 0) {
  console.error(`❌ No variants found for US size ${usSize10}`)
  process.exit(1)
}

console.log(`Found ${size10Variants.length} variant(s) for US size ${usSize10}:\n`)

size10Variants.forEach((variant, idx) => {
  console.log(`--- Variant ${idx + 1} ---`)
  console.log('Variant ID:', variant.variant_id)
  console.log('Size:', variant.size)
  console.log('Product condition:', variant.product_condition || 'N/A')
  console.log('Packaging condition:', variant.packaging_condition || 'N/A')
  console.log()
  console.log('Raw availability data:')
  console.log(JSON.stringify(variant.availability, null, 2))
  console.log()
  console.log('Parsed values:')
  console.log('  lowest_listing_price_cents:', variant.availability.lowest_listing_price_cents,
    variant.availability.lowest_listing_price_cents
      ? `($${parseInt(variant.availability.lowest_listing_price_cents) / 100})`
      : '')
  console.log('  highest_offer_price_cents:', variant.availability.highest_offer_price_cents,
    variant.availability.highest_offer_price_cents
      ? `($${parseInt(variant.availability.highest_offer_price_cents) / 100})`
      : '')
  console.log('  last_sold_listing_price_cents:', variant.availability.last_sold_listing_price_cents,
    variant.availability.last_sold_listing_price_cents
      ? `($${parseInt(variant.availability.last_sold_listing_price_cents) / 100})`
      : '')
  console.log()
})

// Pick the best NEW variant with correct priority
const getConditionScore = (variant) => {
  const productCond = variant.product_condition || ''
  const packagingCond = variant.packaging_condition || ''

  // NEW + GOOD_CONDITION = highest priority
  if (productCond === 'PRODUCT_CONDITION_NEW' && packagingCond === 'PACKAGING_CONDITION_GOOD_CONDITION') {
    return 1000
  }
  // NEW + any other packaging
  if (productCond === 'PRODUCT_CONDITION_NEW') {
    return 500
  }
  // NEW_WITH_DEFECTS
  if (productCond === 'PRODUCT_CONDITION_NEW_WITH_DEFECTS') {
    return 100
  }
  // USED = last resort
  if (productCond === 'PRODUCT_CONDITION_USED') {
    return 10
  }
  return 0
}

const getDataScore = (variant) => {
  let score = 0
  if (variant.availability.highest_offer_price_cents && parseInt(variant.availability.highest_offer_price_cents) > 0) score++
  if (variant.availability.lowest_listing_price_cents && parseInt(variant.availability.lowest_listing_price_cents) > 0) score++
  if (variant.availability.last_sold_listing_price_cents && parseInt(variant.availability.last_sold_listing_price_cents) > 0) score++
  return score
}

const getTotalScore = (variant) => {
  return getConditionScore(variant) + getDataScore(variant)
}

const bestVariant = size10Variants.reduce((best, current) => {
  return getTotalScore(current) > getTotalScore(best) ? current : best
}, size10Variants[0])

console.log('=== BEST VARIANT (NEW condition priority) ===\n')
console.log('Variant ID:', bestVariant.variant_id)
console.log('Product condition:', bestVariant.product_condition)
console.log('Packaging condition:', bestVariant.packaging_condition)
console.log('Condition score:', getConditionScore(bestVariant))
console.log('Data score:', getDataScore(bestVariant))
console.log('Total score:', getTotalScore(bestVariant))
console.log()
console.log('📊 FINAL ANSWER FOR DB STORAGE:')
console.log('  catalog_id:', catalogId)
console.log('  size:', usSize10)
console.log('  currency: USD')
console.log('  lowest_ask_cents (Market column):', bestVariant.availability.lowest_listing_price_cents,
  `→ $${parseInt(bestVariant.availability.lowest_listing_price_cents || 0) / 100}`)
console.log('  highest_bid_cents (Highest Bid column):', bestVariant.availability.highest_offer_price_cents,
  `→ $${parseInt(bestVariant.availability.highest_offer_price_cents || 0) / 100}`)
console.log('  last_sold_price_cents:', bestVariant.availability.last_sold_listing_price_cents,
  `→ $${parseInt(bestVariant.availability.last_sold_listing_price_cents || 0) / 100}`)
console.log()
console.log('✅ These are the values that would be displayed in the UI (in USD, no conversion)')
