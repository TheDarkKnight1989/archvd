#!/usr/bin/env node
/**
 * Test Alias API directly to verify region mapping
 * Compare what API returns vs what we have in database
 */

const ALIAS_PAT = process.env.ALIAS_PAT
const BASE_URL = 'https://api.alias.org/api/v1'

const catalogId = 'dunk-low-black-white-dd1391-100'

async function fetchFromAlias(regionId) {
  const url = new URL(`${BASE_URL}/pricing_insights/availabilities/${catalogId}`)
  if (regionId) {
    url.searchParams.append('region_id', regionId)
  }
  url.searchParams.append('consigned', 'false')

  console.log(`  Fetching: ${url.toString()}`)

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Accept': 'application/json',
    }
  })

  console.log(`  Status: ${res.status}`)

  if (!res.ok) {
    const text = await res.text()
    console.error(`  Error body: ${text.slice(0, 200)}`)
    return null
  }

  return res.json()
}

async function main() {
  console.log('Testing Alias API region responses directly...\n')
  console.log('Looking for Panda Dunks pricing by region...\n')

  const regionNames = { '1': 'US', '2': 'EU', '3': 'UK' }

  for (const regionId of ['1', '2', '3']) {
    console.log(`\n=== Region ${regionId} (${regionNames[regionId]}) ===`)

    const data = await fetchFromAlias(regionId)

    if (!data || !data.variants) {
      console.log('No data returned')
      continue
    }

    const variants = data.variants

    // Find size 10 with actual price
    const size10 = variants.find(v => v.size === 10)
    if (size10) {
      const lowestAsk = parseInt(size10.availability?.lowest_listing_price_cents || '0', 10) / 100
      const highestBid = parseInt(size10.availability?.highest_offer_price_cents || '0', 10) / 100
      console.log(`Size 10: ask=$${lowestAsk} bid=$${highestBid}`)
    }

    // Show a few sizes with non-zero prices
    const withPrices = variants.filter(v => {
      const ask = parseInt(v.availability?.lowest_listing_price_cents || '0', 10)
      return ask > 0
    }).slice(0, 5)

    if (withPrices.length > 0) {
      console.log('Sizes with prices:')
      for (const v of withPrices) {
        const ask = parseInt(v.availability?.lowest_listing_price_cents || '0', 10) / 100
        console.log(`  Size ${v.size}: $${ask}`)
      }
    } else {
      console.log('No sizes with prices found')
    }
  }
}

main().catch(console.error)
