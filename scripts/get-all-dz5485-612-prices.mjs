#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pat = process.env.ALIAS_PAT
const catalogId = 'air-jordan-1-retro-high-og-dz5485-612'

console.log('='.repeat(80))
console.log('FETCHING ALL ALIAS API RESPONSES FOR DZ5485-612')
console.log('Using singular endpoint with NEW + GOOD_CONDITION')
console.log('='.repeat(80))
console.log()

// Test all common US sizes
const sizes = [7, 8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14]

for (const size of sizes) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`SIZE ${size} US`)
  console.log('='.repeat(80))
  
  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: size.toString(),
    product_condition: 'PRODUCT_CONDITION_NEW',
    packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
    consigned: 'false',
  })
  
  const url = `https://api.alias.org/api/v1/pricing_insights/availability?${params}`
  
  console.log('\nREQUEST:')
  console.log(`  Catalog ID: ${catalogId}`)
  console.log(`  Size: ${size} US`)
  console.log(`  Condition: NEW + GOOD_CONDITION`)
  console.log(`  URL: ${url}`)
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
    })
    
    console.log(`\nRESPONSE STATUS: ${response.status}`)
    
    const data = await response.json()
    
    console.log('\nRAW JSON RESPONSE:')
    console.log(JSON.stringify(data, null, 2))
    
    if (response.ok && data.availability) {
      const lowestAsk = parseInt(data.availability.lowest_listing_price_cents || 0)
      const highestBid = parseInt(data.availability.highest_offer_price_cents || 0)
      const lastSold = parseInt(data.availability.last_sold_listing_price_cents || 0)
      const globalIndicator = parseInt(data.availability.global_indicator_price_cents || 0)
      
      console.log('\nPARSED PRICES:')
      console.log(`  Lowest Ask:         ${lowestAsk.toString().padStart(8)} cents  →  $${(lowestAsk/100).toFixed(2)}`)
      console.log(`  Highest Bid:        ${highestBid.toString().padStart(8)} cents  →  $${(highestBid/100).toFixed(2)}`)
      console.log(`  Last Sold:          ${lastSold.toString().padStart(8)} cents  →  $${(lastSold/100).toFixed(2)}`)
      console.log(`  Global Indicator:   ${globalIndicator.toString().padStart(8)} cents  →  $${(globalIndicator/100).toFixed(2)}`)
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
    
  } catch (error) {
    console.log('\nERROR:', error.message)
  }
}

console.log('\n' + '='.repeat(80))
console.log('COMPLETE')
console.log('='.repeat(80))
