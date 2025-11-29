#!/usr/bin/env node
/**
 * Check listing prices in stockx_listings table
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function checkListingPrices() {
  console.log('🔍 Checking listing prices...\n')

  // Get all listings
  const { data: listings, error } = await supabase
    .from('stockx_listings')
    .select('stockx_listing_id, amount, currency_code, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10)

  // Also check for listings with non-null IDs
  const { data: validListings, error: validError } = await supabase
    .from('stockx_listings')
    .select('stockx_listing_id, amount, currency_code, updated_at')
    .not('stockx_listing_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('❌ Error fetching listings:', error)
    return
  }

  if (!listings || listings.length === 0) {
    console.log('⚠️  No listings found in stockx_listings table')
    return
  }

  console.log('All recent listings (including null IDs):')
  console.log('━'.repeat(80))
  listings.forEach(listing => {
    const priceInPounds = listing.amount / 100
    console.log(`Listing ID: ${listing.stockx_listing_id || 'NULL'}`)
    console.log(`  Amount: ${listing.amount} cents (£${priceInPounds.toFixed(2)})`)
    console.log(`  Currency: ${listing.currency_code}`)
    console.log(`  Updated: ${listing.updated_at}`)
    console.log()
  })

  console.log('\nListings with valid IDs:')
  console.log('━'.repeat(80))
  if (validListings && validListings.length > 0) {
    validListings.forEach(listing => {
      const priceInPounds = listing.amount / 100
      console.log(`Listing ID: ${listing.stockx_listing_id}`)
      console.log(`  Amount: ${listing.amount} cents (£${priceInPounds.toFixed(2)})`)
      console.log(`  Currency: ${listing.currency_code}`)
      console.log(`  Updated: ${listing.updated_at}`)
      console.log()
    })
  } else {
    console.log('❌ NO LISTINGS WITH VALID IDs FOUND')
    console.log('This is the problem! All stockx_listings entries have null stockx_listing_id')
  }
}

checkListingPrices().catch(console.error)
