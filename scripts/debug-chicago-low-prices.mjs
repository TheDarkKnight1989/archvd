#!/usr/bin/env node
/**
 * PHASE 3.9: Truth Check Debug Script for Chicago Low Prices
 *
 * Shows the EXACT data flow for Chicago Low UK 9 and UK 11:
 * 1. Raw StockX API response
 * 2. Snapshot row written to DB
 * 3. Row from stockx_market_latest view
 * 4. Final display price used in Portfolio
 *
 * NO GUESSING. NO SUMMARIES. Just raw data from each step.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Chicago Low inventory items
const items = [
  {
    id: '729d9d3d-b9e2-4f1e-8286-e235624b2923',
    sku: 'HQ6998-600',
    size: '9',
    desc: 'Chicago Low UK 9'
  },
  {
    id: '85a1fbbd-b271-4961-b65b-4d862ec2ac23',
    sku: 'HQ6998-600',
    size: '11',
    desc: 'Chicago Low UK 11'
  },
]

// User's currency preference (for Portfolio display logic)
const USER_CURRENCY = 'GBP'

// FX rates (from useInventoryV3.ts)
const FX_RATES = {
  'USD': { 'GBP': 0.79, 'EUR': 0.92 },
  'EUR': { 'GBP': 0.86, 'USD': 1.09 },
  'GBP': { 'USD': 1.27, 'EUR': 1.16 }
}

console.log('🔍 PHASE 3.9: Chicago Low Truth Check\n')
console.log('Purpose: Trace exact data flow from StockX API → DB → Portfolio UI\n')
console.log('=' .repeat(80))

for (const item of items) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📦 ${item.desc} (${item.sku} UK${item.size})`)
  console.log(`   Inventory ID: ${item.id}`)
  console.log('='.repeat(80))

  // ============================================================================
  // STEP 1: Get inventory_market_links mapping
  // ============================================================================

  const { data: link, error: linkError } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id')
    .eq('item_id', item.id)
    .single()

  if (linkError || !link) {
    console.log('\n❌ ERROR: No mapping found in inventory_market_links')
    console.log('   Error:', linkError?.message || 'null result')
    continue
  }

  console.log('\n✅ STEP 1: Mapping from inventory_market_links')
  console.log('   stockx_product_id:', link.stockx_product_id)
  console.log('   stockx_variant_id:', link.stockx_variant_id)

  // ============================================================================
  // STEP 2: Fetch RAW StockX API data
  // ============================================================================

  console.log('\n⏳ STEP 2: Fetching RAW StockX API data...')

  try {
    // Call the EXACT endpoint the worker uses
    const stockxResponse = await fetch(
      `https://api.stockx.com/v2/catalog/products/${link.stockx_product_id}/market`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'archvd/1.0',
          'x-api-key': process.env.STOCKX_API_KEY || '',
        },
      }
    )

    if (!stockxResponse.ok) {
      console.log(`   ❌ StockX API returned ${stockxResponse.status}`)
      const errorText = await stockxResponse.text()
      console.log('   Error:', errorText.substring(0, 200))
      console.log('\\n   ⚠️  Cannot fetch fresh data from StockX API')
      console.log('   ⚠️  Will check what data exists in the database...')
      // DON'T continue - let's see what's in the DB
    } else {

    const stockxData = await stockxResponse.json()

    console.log('\n   ✅ Raw StockX API Response:')
    console.log('   ' + '-'.repeat(76))

    // Find the specific variant data
    const variantData = stockxData?.market?.productMarket?.find(
      (pm) => pm.variantId === link.stockx_variant_id
    )

    if (!variantData) {
      console.log('   ❌ Variant not found in StockX response')
      console.log('   Available variants:')
      stockxData?.market?.productMarket?.forEach((pm) => {
        console.log(`      - ${pm.variantId}: ${pm.variantValue}`)
      })
      continue
    }

    // Print the EXACT JSON for this variant
    console.log(JSON.stringify(variantData, null, 2).split('\n').map(line => '   ' + line).join('\n'))
    console.log('   ' + '-'.repeat(76))

    // Extract prices from the StockX response (same logic as worker)
    const gbpSalesInformation = variantData.salesInformation?.find(
      (si) => si.currencyCode === 'GBP'
    )

    const rawStockxPrices = {
      lowestAsk: gbpSalesInformation?.lowestAsk || null,
      highestBid: gbpSalesInformation?.highestBid || null,
      lastSalePrice: gbpSalesInformation?.lastSale || null,
      currencyCode: 'GBP',
    }

    console.log('\n   📊 Extracted Prices (what would be written to DB):')
    console.log(`      lowest_ask: £${rawStockxPrices.lowestAsk}`)
    console.log(`      highest_bid: £${rawStockxPrices.highestBid}`)
    console.log(`      last_sale_price: £${rawStockxPrices.lastSalePrice}`)
    console.log(`      currency_code: ${rawStockxPrices.currencyCode}`)

  } catch (apiError) {
    console.log('   ❌ Failed to fetch from StockX API')
    console.log('   Error:', apiError.message)
    continue
  }

  // ============================================================================
  // STEP 3: Latest snapshot from stockx_market_snapshots
  // ============================================================================

  console.log('\n✅ STEP 3: Latest snapshot from stockx_market_snapshots')

  const { data: snapshot, error: snapshotError } = await supabase
    .from('stockx_market_snapshots')
    .select('*')
    .eq('stockx_product_id', link.stockx_product_id)
    .eq('stockx_variant_id', link.stockx_variant_id)
    .eq('currency_code', 'GBP')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single()

  if (snapshotError || !snapshot) {
    console.log('   ❌ No snapshot found in stockx_market_snapshots')
    console.log('   Error:', snapshotError?.message || 'null result')
  } else {
    console.log('   ' + '-'.repeat(76))
    console.log('   Snapshot Row (from DB):')
    console.log(`      lowest_ask: £${snapshot.lowest_ask}`)
    console.log(`      highest_bid: £${snapshot.highest_bid}`)
    console.log(`      last_sale_price: £${snapshot.last_sale_price}`)
    console.log(`      currency_code: ${snapshot.currency_code}`)
    console.log(`      snapshot_at: ${snapshot.snapshot_at}`)
    console.log('   ' + '-'.repeat(76))
  }

  // ============================================================================
  // STEP 4: Row from stockx_market_latest view
  // ============================================================================

  console.log('\n✅ STEP 4: Row from stockx_market_latest view')

  const { data: latest, error: latestError } = await supabase
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', link.stockx_product_id)
    .eq('stockx_variant_id', link.stockx_variant_id)
    .eq('currency_code', 'GBP')
    .single()

  if (latestError || !latest) {
    console.log('   ❌ No row found in stockx_market_latest')
    console.log('   Error:', latestError?.message || 'null result')
  } else {
    console.log('   ' + '-'.repeat(76))
    console.log('   Latest Row (from materialized view):')
    console.log(`      lowest_ask: £${latest.lowest_ask}`)
    console.log(`      highest_bid: £${latest.highest_bid}`)
    console.log(`      last_sale_price: £${latest.last_sale_price}`)
    console.log(`      currency_code: ${latest.currency_code}`)
    console.log(`      snapshot_at: ${latest.snapshot_at}`)
    console.log('   ' + '-'.repeat(76))
  }

  // ============================================================================
  // STEP 5: Portfolio Display Price (useInventoryV3 logic)
  // ============================================================================

  console.log('\n✅ STEP 5: Portfolio Display Price (useInventoryV3 logic)')

  if (latest) {
    // EXACT logic from useInventoryV3.ts lines 291-298
    const rawLowestAsk = latest.lowest_ask || null
    const rawHighestBid = latest.highest_bid || null

    // PHASE 3.8: Market price = lowest_ask ?? highest_bid ?? null
    const rawMarketPrice = rawLowestAsk ?? rawHighestBid ?? null

    let marketPrice = rawMarketPrice
    const marketCurrency = latest.currency_code

    // Currency conversion (if needed)
    if (marketCurrency && marketCurrency !== USER_CURRENCY) {
      const rate = FX_RATES[marketCurrency]?.[USER_CURRENCY] || 1.0
      if (marketPrice) marketPrice = marketPrice * rate
    }

    console.log('   ' + '-'.repeat(76))
    console.log('   Price Selection Logic:')
    console.log(`      rawLowestAsk: £${rawLowestAsk}`)
    console.log(`      rawHighestBid: £${rawHighestBid}`)
    console.log(`      rawMarketPrice = rawLowestAsk ?? rawHighestBid: £${rawMarketPrice}`)
    console.log(`      marketCurrency: ${marketCurrency}`)
    console.log(`      USER_CURRENCY: ${USER_CURRENCY}`)
    console.log(`      Currency conversion: ${marketCurrency !== USER_CURRENCY ? 'YES' : 'NO'}`)
    console.log(`      `)
    console.log(`      ⭐ FINAL DISPLAY PRICE: £${marketPrice}`)
    console.log('   ' + '-'.repeat(76))

    // Also show what Instant Sell would be (highest_bid)
    const instantSellGross = rawHighestBid
    const instantSellNet = instantSellGross
      ? Math.round(instantSellGross * 0.9 * 100) / 100
      : null

    console.log('\n   💰 Instant Sell (highest_bid - 10% fee):')
    console.log(`      Gross: £${instantSellGross}`)
    console.log(`      Net (after 10% fee): £${instantSellNet}`)
  }

  console.log()
}

// ============================================================================
// SUMMARY: Compare with StockX website
// ============================================================================

console.log('\n' + '='.repeat(80))
console.log('📋 NEXT STEPS FOR BUILD MANAGER:')
console.log('='.repeat(80))
console.log(`
1. For each Chicago Low item above, compare:
   - "FINAL DISPLAY PRICE" (what Portfolio shows)
   - With the ACTUAL price on StockX website for that size

2. If they DON'T match, look at:
   - STEP 2: Is the StockX API returning the wrong data?
   - STEP 3-4: Is the DB storing it correctly?
   - STEP 5: Is the display logic selecting the right field?

3. If FINAL DISPLAY PRICE matches StockX but UI still shows wrong price:
   - Browser is using old JavaScript bundle (needs hard refresh)
   - Or there's client-side caching

4. If StockX API itself returns wrong data:
   - Check if we're calling the right product/variant
   - Check if StockX has the right size mapping
`)

console.log('=' .repeat(80))
console.log('✅ Truth check complete\n')
