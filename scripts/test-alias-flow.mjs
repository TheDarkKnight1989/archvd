#!/usr/bin/env node
/**
 * Test the full Alias listing flow step by step
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const ALIAS_PAT = process.env.ALIAS_PAT
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1'

if (!ALIAS_PAT) {
  console.error('❌ ALIAS_PAT not found in .env.local')
  process.exit(1)
}

// Test SKU
const TEST_SKU = 'DD1503-124'
const TEST_SIZE = 6

console.log('🧪 Testing Alias API Flow\n')
console.log('═══════════════════════════════════════\n')

// Step 1: Test authentication
console.log('1️⃣  Testing Authentication...')
try {
  const response = await fetch(`${ALIAS_BASE_URL}/test`, {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.ok) {
    const data = await response.json()
    console.log('✅ Authentication successful')
    console.log('   Response:', data)
  } else {
    console.error('❌ Authentication failed:', response.status, response.statusText)
    process.exit(1)
  }
} catch (error) {
  console.error('❌ Auth test failed:', error.message)
  process.exit(1)
}

console.log('\n═══════════════════════════════════════\n')

// Step 2: Use known catalog_id directly (search is unreliable)
console.log('2️⃣  Using Known Catalog ID')
const catalogId = 'wmns-dunk-low-cacao-wow-dd1503-124'
console.log('   Catalog ID:', catalogId)
console.log('   Product: Nike Wmns Dunk Low Cacao Wow')
console.log('   SKU:', TEST_SKU)

console.log('\n═══════════════════════════════════════\n')

// Step 3: Get pricing data
console.log('3️⃣  Getting Pricing Data for:', catalogId)
try {
  const params = new URLSearchParams({
    catalog_id: catalogId,
    size: TEST_SIZE.toString(),
    product_condition: 'CONDITION_NEW',
    packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
  })

  const response = await fetch(`${ALIAS_BASE_URL}/pricing_insights?${params}`, {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.ok) {
    const data = await response.json()
    console.log('✅ Pricing data retrieved')
    console.log('   Lowest Ask:', data.lowest_ask_cents ? `$${(data.lowest_ask_cents / 100).toFixed(2)}` : 'N/A')
    console.log('   Highest Bid:', data.highest_bid_cents ? `$${(data.highest_bid_cents / 100).toFixed(2)}` : 'N/A')
    console.log('   Suggested Sell Price:', data.suggested_seller_price_cents ? `$${(data.suggested_seller_price_cents / 100).toFixed(2)}` : 'N/A')
  } else {
    const text = await response.text()
    console.error('⚠️  Pricing data request failed:', response.status, response.statusText)
    console.error('   Response:', text)
    console.log('   (This might be expected if no pricing data exists for this size/condition)')
  }
} catch (error) {
  console.error('❌ Pricing request failed:', error.message)
}

console.log('\n═══════════════════════════════════════\n')

// Step 4: Test listing creation (with a test price)
console.log('4️⃣  Testing Listing Creation (DRY RUN - will use lowest valid price)')
try {
  const listingBody = {
    catalog_id: catalogId,
    price_cents: 10000, // $100 test price
    size: TEST_SIZE,
    size_unit: 'SIZE_UNIT_US', // FIXED: Use US size unit to match catalog
    condition: 'CONDITION_NEW',
    packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
    activate: false, // Don't activate
  }

  console.log('   Request body:', JSON.stringify(listingBody, null, 2))

  const response = await fetch(`${ALIAS_BASE_URL}/listings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(listingBody),
  })

  if (response.ok) {
    const data = await response.json()
    console.log('✅ Listing creation successful!')
    console.log('   Listing ID:', data.id)
    console.log('   Status:', data.status)
    console.log('   Price:', `$${(data.price_cents / 100).toFixed(2)}`)

    // Clean up - delete the test listing
    console.log('\n   Cleaning up test listing...')
    const deleteResponse = await fetch(`${ALIAS_BASE_URL}/listings/${data.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    })

    if (deleteResponse.ok) {
      console.log('   ✅ Test listing deleted')
    }
  } else {
    const text = await response.text()
    console.error('❌ Listing creation failed:', response.status, response.statusText)
    console.error('   Response:', text)

    // Try to parse as JSON for better error message
    try {
      const errorData = JSON.parse(text)
      console.error('   Error details:', errorData)
    } catch {
      // Not JSON, already logged
    }
  }
} catch (error) {
  console.error('❌ Listing creation failed:', error.message)
}

console.log('\n═══════════════════════════════════════')
console.log('\n✅ Test complete!')
