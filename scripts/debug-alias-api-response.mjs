#!/usr/bin/env node

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function debugAliasAPI() {
  // Inline the client creation since imports are messy
  const pat = process.env.ALIAS_PAT
  if (!pat) {
    throw new Error('ALIAS_PAT not found in environment')
  }

  const baseURL = 'https://api.alias.org/api/v1'

  async function fetchAlias(endpoint) {
    const response = await fetch(`${baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Alias API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Test with known catalog ID
  const catalogId = 'air-jordan-5-retro-grape-2025-hq7978-100'

  console.log('=== FETCHING PRICING INSIGHTS FROM ALIAS API ===\n')
  console.log('Catalog ID:', catalogId)
  console.log()

  const response = await fetchAlias(`/pricing_insights/availabilities/${catalogId}`)

  console.log('Response variants count:', response.variants.length)
  console.log()

  // Show first few variants with pricing
  console.log('=== SAMPLE VARIANTS WITH PRICING ===\n')

  const sampleVariants = response.variants.slice(0, 10).filter(v => v.availability)

  for (const variant of sampleVariants) {
    console.log(`Size: ${variant.size}`)
    console.log('  Availability:', {
      lowest_listing_price_cents: variant.availability.lowest_listing_price_cents,
      highest_offer_price_cents: variant.availability.highest_offer_price_cents,
      last_sold_listing_price_cents: variant.availability.last_sold_listing_price_cents,
      global_indicator_price_cents: variant.availability.global_indicator_price_cents,
    })

    // Convert to dollars for readability
    const lowestListing = variant.availability.lowest_listing_price_cents
      ? parseInt(variant.availability.lowest_listing_price_cents, 10) / 100
      : null
    const highestOffer = variant.availability.highest_offer_price_cents
      ? parseInt(variant.availability.highest_offer_price_cents, 10) / 100
      : null

    console.log('  In dollars:')
    console.log(`    lowest_listing_price: $${lowestListing}`)
    console.log(`    highest_offer_price: $${highestOffer}`)

    if (lowestListing && highestOffer) {
      if (lowestListing < highestOffer) {
        console.log('    ⚠️  ALERT: lowest_listing < highest_offer (REVERSED!)')
      } else {
        console.log('    ✓ Normal: lowest_listing > highest_offer')
      }
    }
    console.log()
  }

  console.log('\n=== CONCLUSION ===')
  console.log('If we see "REVERSED" alerts, the Alias API returns:')
  console.log('  - lowest_listing_price_cents = what BUYERS pay (lowest ask from sellers)')
  console.log('  - highest_offer_price_cents = what SELLERS get (highest bid from buyers)')
  console.log('This would be the OPPOSITE of normal market terminology!')
}

debugAliasAPI().catch(console.error)
