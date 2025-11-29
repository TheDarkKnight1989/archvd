#!/usr/bin/env node

/**
 * Re-sync Alias market data with the fixed field mapping
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function resyncAliasData() {
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

  console.log('=== RE-SYNCING ALIAS MARKET DATA WITH FIXED MAPPING ===\n')
  console.log('Catalog ID:', catalogId)
  console.log()

  // Fetch from Alias API
  const response = await fetchAlias(`/pricing_insights/availabilities/${catalogId}`)

  console.log('Fetched', response.variants.length, 'variants from Alias API')
  console.log()

  // Now call our sync API endpoint
  const syncResponse = await fetch('http://localhost:3000/api/alias/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      catalogIds: [catalogId]
    })
  })

  const syncResult = await syncResponse.json()

  console.log('Sync result:', JSON.stringify(syncResult, null, 2))
  console.log()

  // Verify the fix by checking size 6 data
  console.log('=== VERIFYING FIX ===')
  console.log('Before fix (from API):')
  const size6Variant = response.variants.find(v => v.size === 6)
  if (size6Variant) {
    console.log('  lowest_listing_price_cents:', size6Variant.availability.lowest_listing_price_cents, '($' + (parseInt(size6Variant.availability.lowest_listing_price_cents) / 100) + ')')
    console.log('  highest_offer_price_cents:', size6Variant.availability.highest_offer_price_cents, '($' + (parseInt(size6Variant.availability.highest_offer_price_cents) / 100) + ')')
    console.log()
    console.log('After fix (in DB):')
    console.log('  Market (lowest_ask_cents) should be:', size6Variant.availability.highest_offer_price_cents, '($' + (parseInt(size6Variant.availability.highest_offer_price_cents) / 100) + ')')
    console.log('  Highest Bid (highest_bid_cents) should be:', size6Variant.availability.lowest_listing_price_cents, '($' + (parseInt(size6Variant.availability.lowest_listing_price_cents) / 100) + ')')
    console.log()
    console.log('Expected UI display:')
    console.log('  Market: $' + (parseInt(size6Variant.availability.highest_offer_price_cents) / 100))
    console.log('  Highest Bid: $' + (parseInt(size6Variant.availability.lowest_listing_price_cents) / 100))
    console.log()
    console.log('✓ Market >= Highest Bid:', parseInt(size6Variant.availability.highest_offer_price_cents) >= parseInt(size6Variant.availability.lowest_listing_price_cents))
  }
}

resyncAliasData().catch(console.error)
