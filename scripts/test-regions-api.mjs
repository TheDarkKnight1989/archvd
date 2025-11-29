#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pat = process.env.ALIAS_PAT

// Try to fetch available regions
console.log('=== FETCHING AVAILABLE REGIONS ===\n')

const response = await fetch('https://api.alias.org/api/v1/regions', {
  headers: {
    'Authorization': `Bearer ${pat}`,
  },
})

console.log('Status:', response.status)

if (response.ok) {
  const data = await response.json()
  console.log('Regions:', JSON.stringify(data, null, 2))
  
  // Try pricing with first valid region
  if (data.regions && data.regions.length > 0) {
    const regionId = data.regions[0].region_id
    console.log(`\n=== TESTING WITH VALID REGION: ${regionId} ===\n`)
    
    const params = new URLSearchParams({
      catalog_id: 'air-jordan-1-retro-high-og-dz5485-612',
      size: '11',
      product_condition: 'PRODUCT_CONDITION_NEW',
      packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
      consigned: 'false',
      region_id: regionId,
    })
    
    const priceResponse = await fetch(`https://api.alias.org/api/v1/pricing_insights/availability?${params}`, {
      headers: {
        'Authorization': `Bearer ${pat}`,
      },
    })
    
    console.log('Status:', priceResponse.status)
    const priceData = await priceResponse.json()
    
    if (priceResponse.ok) {
      console.log('Lowest Ask:', priceData.availability.lowest_listing_price_cents, `→ $${parseInt(priceData.availability.lowest_listing_price_cents) / 100}`)
    } else {
      console.log('Error:', JSON.stringify(priceData, null, 2))
    }
  }
} else {
  const text = await response.text()
  console.log('Error:', text || response.statusText)
}
