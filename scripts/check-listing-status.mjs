#!/usr/bin/env node
/**
 * Check StockX Listing Status
 * Fetches a specific listing from StockX API to see its current status
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const listingId = process.argv[2] || '6df95d08-f555-4d6b-ae98-31339c4bd957'

console.log(`\n🔍 Checking listing: ${listingId}\n`)

// Get user ID from the listing
const { data: link } = await supabase
  .from('inventory_market_links')
  .select('user_id, stockx_listing_id, stockx_listing_status')
  .eq('stockx_listing_id', listingId)
  .single()

if (!link) {
  console.error('❌ Listing not found in database')
  process.exit(1)
}

console.log('📊 Database status:', {
  stockx_listing_id: link.stockx_listing_id,
  stockx_listing_status: link.stockx_listing_status,
  user_id: link.user_id,
})

// Get StockX access token
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', link.user_id)
  .single()

if (!account?.access_token) {
  console.error('❌ No StockX access token found')
  process.exit(1)
}

// Fetch listing from StockX API
console.log('\n🌐 Fetching from StockX API...\n')

try {
  const response = await fetch(
    `https://api.stockx.com/v2/selling/listings/${listingId}`,
    {
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'x-api-key': process.env.STOCKX_API_KEY,
        'Accept': 'application/json',
      },
    }
  )

  if (!response.ok) {
    console.error('❌ StockX API error:', response.status, response.statusText)
    const error = await response.text()
    console.error(error)
    process.exit(1)
  }

  const data = await response.json()

  console.log('✅ StockX API Response:')
  console.log(JSON.stringify(data, null, 2))

  if (data.status) {
    console.log(`\n📌 Current StockX Status: ${data.status}`)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
