#!/usr/bin/env node
/**
 * A/B Test: StockX Client - Controlled Comparison (V2 - Standalone)
 *
 * Purpose: Prove whether HQ6998-600 404 is an API issue or our code issue
 *
 * Method:
 * - Make direct HTTP requests to StockX API (no imports from src/)
 * - Test two items side-by-side:
 *   - TEST A: DD1391-100 UK 14 (known working)
 *   - TEST B: HQ6998-600 UK 9 (problem case)
 * - Show raw request/response for both
 *
 * NO MOCKING. NO GUESSING. JUST RAW EVIDENCE.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const STOCKX_API_BASE = process.env.STOCKX_API_BASE_URL || 'https://api.stockx.com'

// Test cases
const TEST_CASES = [
  {
    name: 'TEST A: CONTROL (AUTO-SELECTED WORKING ITEM)',
    sku: null, // Will auto-select first working item from DB
    size: null,
    inventoryId: null,
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
console.log('Method: Direct HTTP requests to StockX API for both items')
console.log('No mocking. No guessing. Just raw evidence.')
console.log('='.repeat(80) + '\n')

/**
 * Get StockX access token from environment or database
 */
async function getStockxAccessToken() {
  // First try environment variable
  if (process.env.STOCKX_ACCESS_TOKEN) {
    console.log('  Using STOCKX_ACCESS_TOKEN from environment')
    return process.env.STOCKX_ACCESS_TOKEN
  }

  // Fall back to database
  const { data, error } = await supabase
    .from('stockx_tokens')
    .select('access_token, expires_at')
    .eq('user_id', 'system')
    .single()

  if (error || !data) {
    throw new Error('No StockX access token found in environment or database. Set STOCKX_ACCESS_TOKEN env var or run auth script.')
  }

  const expiresAt = new Date(data.expires_at)
  if (expiresAt < new Date()) {
    throw new Error('StockX access token expired. Run auth script to refresh or set STOCKX_ACCESS_TOKEN env var.')
  }

  console.log('  Using access token from database')
  return data.access_token
}

/**
 * Make StockX API request
 */
async function callStockxApi(endpoint, accessToken) {
  const url = `${STOCKX_API_BASE}${endpoint}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  const statusCode = response.status
  let body

  try {
    body = await response.json()
  } catch (e) {
    body = await response.text()
  }

  return { statusCode, body }
}

// Get access token
let accessToken
try {
  accessToken = await getStockxAccessToken()
  console.log('✅ Retrieved StockX access token from database\n')
} catch (error) {
  console.error('❌ Failed to get StockX access token:', error.message)
  process.exit(1)
}

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

      let query
      if (!testCase.sku || !testCase.size) {
        // Auto-select any item with StockX mapping
        console.log('  Auto-selecting working item with StockX mapping...')
        const { data: links, error: linkErr } = await supabase
          .from('inventory_market_links')
          .select('item_id, stockx_product_id, stockx_variant_id')
          .not('stockx_product_id', 'is', null)
          .limit(10)

        if (linkErr || !links || links.length === 0) {
          console.log(`  ❌ No items with StockX mappings found`)
          console.log(`  Skipping this test case\n`)
          continue
        }

        // Pick first item that's not the HQ6998-600 problem case
        const workingLink = links.find(l => l.stockx_product_id !== '83c11c36-1e00-4831-85e5-6067abf2f18b')
        if (!workingLink) {
          console.log(`  ❌ No working items found (all have broken mappings)`)
          console.log(`  Skipping this test case\n`)
          continue
        }

        inventoryId = workingLink.item_id

        // Look up the SKU/size for display
        const { data: inv } = await supabase
          .from('Inventory')
          .select('sku, size, brand, model')
          .eq('id', inventoryId)
          .single()

        if (inv) {
          testCase.sku = inv.sku
          testCase.size = inv.size
          console.log(`  ✅ Selected: ${inv.brand} ${inv.model} (${inv.sku}) Size ${inv.size}`)
          console.log(`  ✅ Inventory ID: ${inventoryId}`)
        }
      } else {
        // Look up by SKU and size
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
      }
    } else {
      console.log(`STEP 1: Using provided inventory ID: ${inventoryId}`)
    }

    // STEP 2: Get StockX mapping from inventory_market_links
    console.log('\nSTEP 2: Reading StockX mapping from inventory_market_links...')
    const { data: link, error: linkError } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
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

    const productId = link.stockx_product_id
    const variantId = link.stockx_variant_id

    // STEP 3: Call StockX API directly
    console.log('\nSTEP 3: Calling StockX API (DIRECT HTTP REQUEST)...')
    const currencyCode = 'GBP'
    const endpoint = `/v2/catalog/products/${productId}/market-data?currencyCode=${currencyCode}`

    console.log('REQUEST DETAILS:')
    console.log(`  Method: GET`)
    console.log(`  Base URL: ${STOCKX_API_BASE}`)
    console.log(`  Endpoint: ${endpoint}`)
    console.log(`  Product ID: ${productId}`)
    console.log(`  Variant ID: ${variantId}`)
    console.log(`  Currency: ${currencyCode}`)
    console.log()

    const { statusCode, body } = await callStockxApi(endpoint, accessToken)

    console.log('RESPONSE:')
    console.log(`  Status: ${statusCode}`)
    console.log()

    if (statusCode === 200) {
      console.log('RAW RESPONSE BODY:')
      console.log(JSON.stringify(body, null, 2).split('\n').slice(0, 25).join('\n'))
      if (JSON.stringify(body, null, 2).split('\n').length > 25) {
        console.log('  ... (trimmed)')
      }
      console.log()

      // Find the specific variant
      const variants = Array.isArray(body) ? body : []
      const targetVariant = variants.find(v => v.variantId === variantId)

      if (targetVariant) {
        console.log('TARGET VARIANT DATA:')
        console.log(`  Variant ID: ${targetVariant.variantId}`)
        console.log(`  Variant Value: ${targetVariant.variantValue || targetVariant.size || 'N/A'}`)
        console.log(`  Lowest Ask: ${targetVariant.lowestAskAmount ?? 'null'}`)
        console.log(`  Highest Bid: ${targetVariant.highestBidAmount ?? 'null'}`)
        console.log(`  Sales Last 72h: ${targetVariant.salesLast72Hours ?? 'null'}`)
        console.log()
      } else {
        console.log(`⚠️  WARNING: Variant ${variantId} not found in response`)
        console.log(`  API returned ${variants.length} variants, but our target variant is missing`)
        console.log()
      }

      console.log('✅ SUCCESS: API returned 200 OK with market data')

    } else {
      console.log('ERROR RESPONSE BODY:')
      console.log(JSON.stringify(body, null, 2))
      console.log()

      const is404 = statusCode === 404
      if (is404) {
        console.log('❌ FAILED: 404 - Product not found on StockX')
        console.log('   This means the product_id in our database is INVALID')
      } else {
        console.log(`❌ FAILED: ${statusCode} - ${body.message || 'Unknown error'}`)
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
console.log('   → YES - Both used direct HTTP GET requests to the same API endpoint')
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
console.log('   → The ONLY difference is the product_id from our mapping')
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
