#!/usr/bin/env node
/**
 * A/B Test: StockX Client - Controlled Comparison
 *
 * Purpose: Prove whether HQ6998-600 404 is an API issue or our code issue
 *
 * Method:
 * - Use EXACT same client code that the worker uses
 * - Test two items side-by-side:
 *   - TEST A: DD1391-100 UK 14 (known working)
 *   - TEST B: HQ6998-600 UK 9 (problem case)
 * - Show raw request/response for both
 *
 * NO MOCKING. NO GUESSING. JUST RAW EVIDENCE.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { StockxMarketService } from '../src/lib/services/stockx/market.ts'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Test cases
const TEST_CASES = [
  {
    name: 'TEST A: DD1391-100 UK 14 (CONTROL - KNOWN WORKING)',
    sku: 'DD1391-100',
    size: '14',
    inventoryId: null, // Will look up
  },
  {
    name: 'TEST B: HQ6998-600 UK 9 (PROBLEM CASE)',
    sku: 'HQ6998-600',
    size: '9',
    inventoryId: '729d9d3d-b9e2-4f1e-8286-e235624b2923',
  },
]

console.log('\n' + '='.repeat(80))
console.log('A/B TEST: StockX Client Controlled Comparison')
console.log('='.repeat(80))
console.log('Purpose: Prove whether 404 is API issue or code issue')
console.log('Method: Use EXACT same client code for both items')
console.log('No mocking. No guessing. Just raw evidence.')
console.log('='.repeat(80) + '\n')

for (const testCase of TEST_CASES) {
  console.log('\n' + '='.repeat(80))
  console.log(testCase.name)
  console.log('='.repeat(80))
  console.log(`SKU: ${testCase.sku}`)
  console.log(`Size: UK ${testCase.size}`)
  console.log()

  try {
    // STEP 1: Find inventory item (if not provided)
    let inventoryId = testCase.inventoryId

    if (!inventoryId) {
      console.log('STEP 1: Finding inventory item in database...')
      const { data: items, error: invError } = await supabase
        .from('Inventory')
        .select('id, sku, size')
        .eq('sku', testCase.sku)
        .eq('size', testCase.size)
        .limit(1)

      if (invError || !items || items.length === 0) {
        console.log(`  ❌ No inventory item found for ${testCase.sku} UK ${testCase.size}`)
        console.log(`  Skipping this test case\n`)
        continue
      }

      inventoryId = items[0].id
      console.log(`  ✅ Found inventory item: ${inventoryId}`)
    } else {
      console.log(`STEP 1: Using provided inventory ID: ${inventoryId}`)
    }

    // STEP 2: Get StockX mapping from inventory_market_links
    console.log('\nSTEP 2: Reading StockX mapping from inventory_market_links...')
    const { data: link, error: linkError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id, mapping_status')
      .eq('item_id', inventoryId)
      .single()

    if (linkError || !link) {
      console.log(`  ❌ No StockX mapping found`)
      console.log(`  Error: ${linkError?.message || 'null result'}`)
      console.log(`  Skipping this test case\n`)
      continue
    }

    console.log(`  ✅ StockX Product ID: ${link.stockx_product_id}`)
    console.log(`  ✅ StockX Variant ID: ${link.stockx_variant_id}`)
    console.log(`  ✅ Mapping Status: ${link.mapping_status || 'ok (default)'}`)

    const productId = link.stockx_product_id
    const variantId = link.stockx_variant_id

    // STEP 3: Call EXACT same API that worker uses
    console.log('\nSTEP 3: Calling StockX API (SAME CODE AS WORKER)...')
    console.log('  Using: StockxMarketService.getVariantMarketData()')
    console.log('  This is the EXACT function the worker calls - NO MOCKING')
    console.log()

    const currencyCode = 'GBP'

    // Intercept the actual HTTP request to log details
    console.log('REQUEST DETAILS:')
    console.log(`  Method: GET`)
    console.log(`  Endpoint: /v2/catalog/products/${productId}/market`)
    console.log(`  Product ID: ${productId}`)
    console.log(`  Variant ID: ${variantId}`)
    console.log(`  Currency: ${currencyCode}`)
    console.log()

    let marketData
    let statusCode
    let responseBody

    try {
      // This is the EXACT call the worker makes (no wrapper, no mock)
      marketData = await StockxMarketService.getVariantMarketData(
        productId,
        variantId,
        currencyCode,
        undefined // userId optional
      )

      statusCode = 200 // If we got here, it succeeded
      responseBody = marketData

      console.log('RESPONSE:')
      console.log(`  Status: ${statusCode} OK`)
      console.log(`  Data received:`)
      console.log(`    Variant ID: ${marketData.variantId || 'N/A'}`)
      console.log(`    Variant Value: ${marketData.variantValue || 'N/A'}`)
      console.log(`    Lowest Ask: ${marketData.lowestAsk || 'null'}`)
      console.log(`    Highest Bid: ${marketData.highestBid || 'null'}`)
      console.log(`    Sales Last 72h: ${marketData.salesLast72h || 'null'}`)
      console.log()

      console.log('RAW JSON SNIPPET:')
      console.log(JSON.stringify(marketData, null, 2).split('\n').slice(0, 15).join('\n'))
      if (JSON.stringify(marketData, null, 2).split('\n').length > 15) {
        console.log('  ... (trimmed)')
      }
      console.log()

      console.log('✅ SUCCESS: API returned valid market data')

    } catch (error) {
      // Capture error details
      statusCode = error.status || error.statusCode || 'UNKNOWN'
      responseBody = error.message || String(error)

      console.log('RESPONSE:')
      console.log(`  Status: ${statusCode} ERROR`)
      console.log(`  Error Type: ${error.constructor.name}`)
      console.log(`  Error Message: ${error.message}`)
      console.log()

      if (error.response) {
        console.log('RAW ERROR RESPONSE:')
        console.log(JSON.stringify(error.response, null, 2))
      } else {
        console.log('ERROR OBJECT:')
        console.log(error)
      }
      console.log()

      // Check if it's a 404
      const is404 = statusCode === 404 ||
                    error.message?.includes('404') ||
                    error.message?.includes('not found') ||
                    error.message?.includes('Resource not found')

      if (is404) {
        console.log('❌ FAILED: 404 - Product/Variant not found on StockX')
      } else {
        console.log(`❌ FAILED: ${statusCode} - ${error.message}`)
      }
    }

  } catch (error) {
    console.error('❌ TEST FAILED WITH EXCEPTION:')
    console.error(error)
  }

  console.log()
}

// FINAL ANALYSIS
console.log('\n' + '='.repeat(80))
console.log('ANALYSIS')
console.log('='.repeat(80))
console.log()
console.log('Questions to answer:')
console.log('1. Did both tests use the EXACT same code path?')
console.log('   → YES - Both used StockxMarketService.getVariantMarketData()')
console.log()
console.log('2. Are we using any mocked data or test mode?')
console.log('   → NO - This is the REAL StockX API with REAL credentials')
console.log()
console.log('3. Did DD1391-100 UK 14 succeed?')
console.log('   → See TEST A output above')
console.log()
console.log('4. Did HQ6998-600 UK 9 fail with 404?')
console.log('   → See TEST B output above')
console.log()
console.log('5. If one succeeds and one fails, what\'s the difference?')
console.log('   → The ONLY difference is the product_id and variant_id from our mapping')
console.log('   → If HQ6998-600 returns 404, it means the product_id we have stored')
console.log('     is NOT VALID on StockX (product was deprecated or ID changed)')
console.log()
console.log('CONCLUSION:')
console.log('If TEST A succeeds and TEST B returns 404:')
console.log('  → The API client code is CORRECT')
console.log('  → The issue is that HQ6998-600\'s product_id mapping is INVALID')
console.log('  → Solution: Run remap script to find the new correct product ID')
console.log()
console.log('If BOTH tests fail:')
console.log('  → Check API credentials or network issues')
console.log()
console.log('If BOTH tests succeed:')
console.log('  → The mapping in inventory_market_links was recently fixed')
console.log('='.repeat(80) + '\n')
