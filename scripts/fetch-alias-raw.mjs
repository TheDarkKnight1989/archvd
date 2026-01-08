/**
 * Fetch raw Alias API response and compare to database
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALIAS_PAT = process.env.ALIAS_PAT
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1'

async function fetchAlias(endpoint, params = {}) {
  const url = new URL(`${ALIAS_BASE_URL}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Alias API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function main() {
  // Find a catalog with data
  const { data: variants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, alias_catalog_id, size_value, size_display, consigned, region_id')
    .limit(10)

  if (!variants?.length) {
    console.error('No variants found')
    return
  }

  const catalogId = variants[0].alias_catalog_id
  console.log('================================================================================')
  console.log('ALIAS RAW API vs DATABASE COMPARISON')
  console.log('================================================================================\n')
  console.log(`Testing catalog: ${catalogId}`)

  // Get product info
  const { data: product } = await supabase
    .from('inventory_v4_alias_products')
    .select('sku, name, brand')
    .eq('alias_catalog_id', catalogId)
    .single()

  console.log(`SKU: ${product?.sku}`)
  console.log(`Name: ${product?.brand} ${product?.name}`)
  console.log('')

  // Fetch raw API response for UK region (region_id=3)
  console.log('=== RAW API RESPONSE (region_id=3, consigned=false) ===\n')

  const rawResponse = await fetchAlias(`/pricing_insights/availabilities/${catalogId}`, {
    region_id: '3',
    consigned: 'false'
  })

  // Show a few raw variants
  console.log('First 5 API variants:')
  const sampleApiVariants = rawResponse.variants.slice(0, 5)
  for (const v of sampleApiVariants) {
    console.log(`  Size ${v.size}: `)
    console.log(`    product_condition: ${v.product_condition}`)
    console.log(`    packaging_condition: ${v.packaging_condition}`)
    console.log(`    consigned: ${v.consigned}`)
    console.log(`    availability: ${JSON.stringify(v.availability)}`)
    console.log('')
  }

  // Filter to NEW + GOOD
  const filteredApiVariants = rawResponse.variants.filter(v =>
    v.product_condition === 'PRODUCT_CONDITION_NEW' &&
    v.packaging_condition === 'PACKAGING_CONDITION_GOOD_CONDITION'
  )

  console.log(`Total API variants: ${rawResponse.variants.length}`)
  console.log(`Filtered (NEW + GOOD): ${filteredApiVariants.length}`)
  console.log('')

  // Count null prices in API
  let apiNullLowestAsk = 0
  let apiNullHighestBid = 0
  let apiZeroLowestAsk = 0
  let apiZeroHighestBid = 0

  for (const v of filteredApiVariants) {
    const ask = v.availability?.lowest_listing_price_cents
    const bid = v.availability?.highest_offer_price_cents

    if (ask === null || ask === undefined) apiNullLowestAsk++
    else if (ask === '0') apiZeroLowestAsk++

    if (bid === null || bid === undefined) apiNullHighestBid++
    else if (bid === '0') apiZeroHighestBid++
  }

  console.log('=== API NULL/ZERO ANALYSIS ===')
  console.log(`  lowest_listing_price_cents NULL: ${apiNullLowestAsk}`)
  console.log(`  lowest_listing_price_cents "0": ${apiZeroLowestAsk}`)
  console.log(`  highest_offer_price_cents NULL: ${apiNullHighestBid}`)
  console.log(`  highest_offer_price_cents "0": ${apiZeroHighestBid}`)
  console.log('')

  // Get database data for same variants
  const variantIds = variants.filter(v => v.alias_catalog_id === catalogId).map(v => v.id)
  const { data: dbMarketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, highest_bid')
    .in('alias_variant_id', variantIds)

  console.log('=== DATABASE NULL ANALYSIS ===')
  let dbNullLowestAsk = 0
  let dbNullHighestBid = 0
  for (const m of dbMarketData || []) {
    if (m.lowest_ask === null) dbNullLowestAsk++
    if (m.highest_bid === null) dbNullHighestBid++
  }
  console.log(`  DB lowest_ask NULL: ${dbNullLowestAsk} / ${dbMarketData?.length || 0}`)
  console.log(`  DB highest_bid NULL: ${dbNullHighestBid} / ${dbMarketData?.length || 0}`)
  console.log('')

  // Show side-by-side comparison
  console.log('=== SIDE-BY-SIDE COMPARISON (first 5 sizes) ===\n')

  for (const apiV of filteredApiVariants.slice(0, 5)) {
    const sizeValue = parseFloat(apiV.size)
    const dbVariant = variants.find(v =>
      v.alias_catalog_id === catalogId &&
      v.size_value === sizeValue &&
      v.consigned === false &&
      v.region_id === '3'
    )

    const dbMarket = dbVariant ? dbMarketData?.find(m => m.alias_variant_id === dbVariant.id) : null

    console.log(`Size ${apiV.size}:`)
    console.log(`  API lowest_listing_price_cents: ${apiV.availability?.lowest_listing_price_cents}`)
    console.log(`  DB  lowest_ask:                 ${dbMarket?.lowest_ask}`)
    console.log(`  API highest_offer_price_cents:  ${apiV.availability?.highest_offer_price_cents}`)
    console.log(`  DB  highest_bid:                ${dbMarket?.highest_bid}`)
    console.log('')
  }

  console.log('================================================================================')
  console.log('CONCLUSION:')
  console.log('If API returns null/"0" and DB has null, that\'s expected (provider limitation).')
  console.log('If API returns a valid price and DB has null, that\'s a mapping bug.')
  console.log('================================================================================')
}

main().catch(console.error)
