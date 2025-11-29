#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pat = process.env.ALIAS_PAT
const catalogId = 'air-jordan-1-retro-high-og-dz5485-612'
const usSize = 11

async function testRegion(regionId) {
  console.log(`\n=== TESTING region_id: ${regionId || '(omitted)'} ===\n`)
  
  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: usSize.toString(),
    product_condition: 'PRODUCT_CONDITION_NEW',
    packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
    consigned: 'false',
  })
  
  if (regionId) {
    params.set('region_id', regionId)
  }
  
  const url = `https://api.alias.org/api/v1/pricing_insights/availability?${params}`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
  })
  
  console.log('Status:', response.status)
  
  const data = await response.json()
  
  if (response.ok) {
    console.log('Lowest Ask:', data.availability.lowest_listing_price_cents, `→ $${parseInt(data.availability.lowest_listing_price_cents) / 100}`)
    console.log('Highest Bid:', data.availability.highest_offer_price_cents, `→ $${parseInt(data.availability.highest_offer_price_cents) / 100}`)
    console.log('Last Sold:', data.availability.last_sold_listing_price_cents, `→ $${parseInt(data.availability.last_sold_listing_price_cents) / 100}`)
  } else {
    console.log('Error:', JSON.stringify(data, null, 2))
  }
}

// Test different region values
await testRegion(null)  // No region
await testRegion('UK')
await testRegion('GB')
await testRegion('US')
await testRegion('EU')
