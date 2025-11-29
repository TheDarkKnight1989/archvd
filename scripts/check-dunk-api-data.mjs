#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkDunkAPI() {
  const pat = process.env.ALIAS_PAT
  const catalogId = 'wmns-dunk-low-cacao-wow-dd1503-124'

  const response = await fetch(`https://api.alias.org/api/v1/pricing_insights/availabilities/${catalogId}`, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()

  console.log('Looking for size 6...\n')

  const size6Variants = data.variants.filter(v => v.size === 6 && v.availability)

  for (const variant of size6Variants) {
    console.log('Size 6 variant:')
    console.log('  lowest_listing_price_cents:', variant.availability.lowest_listing_price_cents, `($${parseInt(variant.availability.lowest_listing_price_cents) / 100})`)
    console.log('  highest_offer_price_cents:', variant.availability.highest_offer_price_cents, `($${parseInt(variant.availability.highest_offer_price_cents) / 100})`)
    console.log('  last_sold_listing_price_cents:', variant.availability.last_sold_listing_price_cents, `($${parseInt(variant.availability.last_sold_listing_price_cents) / 100})`)
    console.log()
  }

  console.log('After SWAP (what should be in DB):')
  const best = size6Variants[0]
  if (best) {
    console.log('  lowest_ask_cents should be:', best.availability.highest_offer_price_cents, `($${parseInt(best.availability.highest_offer_price_cents || 0) / 100})`)
    console.log('  highest_bid_cents should be:', best.availability.lowest_listing_price_cents, `($${parseInt(best.availability.lowest_listing_price_cents || 0) / 100})`)
  }
}

checkDunkAPI().catch(console.error)
