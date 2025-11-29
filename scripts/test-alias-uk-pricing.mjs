#!/usr/bin/env node
/**
 * Test Alias pricing API with UK region
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const ALIAS_PAT = process.env.ALIAS_PAT

if (!ALIAS_PAT) {
  console.error('❌ ALIAS_PAT not found in .env.local')
  process.exit(1)
}

// Test with a catalog ID we know exists
const catalogId = 'air-jordan-5-retro-grape-2025-hq7978-100'

async function testRegion(regionId) {
  console.log(`\n🔍 Testing region: ${regionId || 'default (US)'}`)
  console.log(`Catalog: ${catalogId}\n`)

  const url = `https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}${regionId ? `?region_id=${regionId}` : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error response:', errorText)
      return null
    }

    const data = await response.json()

    console.log(`✅ Success! Found ${data.variants?.length || 0} variants\n`)

    if (data.variants && data.variants.length > 0) {
      // Show first 3 variants as sample
      const samples = data.variants.slice(0, 3)

      for (const variant of samples) {
        console.log(`  Size: ${variant.size}`)
        console.log(`  Condition: ${variant.product_condition}`)
        console.log(`  Packaging: ${variant.packaging_condition}`)

        if (variant.availability) {
          const lowestAsk = variant.availability.lowest_listing_price_cents
          const highestBid = variant.availability.highest_offer_price_cents
          const lastSold = variant.availability.last_sold_listing_price_cents

          console.log(`  Lowest Ask: ${lowestAsk ? `$${(parseInt(lowestAsk) / 100).toFixed(2)}` : 'N/A'}`)
          console.log(`  Highest Bid: ${highestBid ? `$${(parseInt(highestBid) / 100).toFixed(2)}` : 'N/A'}`)
          console.log(`  Last Sold: ${lastSold ? `$${(parseInt(lastSold) / 100).toFixed(2)}` : 'N/A'}`)
        }
        console.log()
      }
    }

    return data
  } catch (error) {
    console.error('❌ Request failed:', error.message)
    return null
  }
}

async function main() {
  console.log('🧪 Testing Alias Pricing API with different regions\n')
  console.log('=' .repeat(60))

  // Test default (US)
  await testRegion(null)

  console.log('=' .repeat(60))

  // Test UK
  await testRegion('UK')

  console.log('=' .repeat(60))

  // Test GB
  await testRegion('GB')

  console.log('=' .repeat(60))
  console.log('\n✅ Test complete')
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
