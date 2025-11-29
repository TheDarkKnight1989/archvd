#!/usr/bin/env node
/**
 * Verify Alias listing was created
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const ALIAS_PAT = process.env.ALIAS_PAT
const ALIAS_BASE_URL = 'https://api.alias.org/api/v1'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!ALIAS_PAT) {
  console.error('❌ ALIAS_PAT not found')
  process.exit(1)
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const INVENTORY_ID = 'd6886554-dff3-43dd-b3d3-93318e2bcc09'
const LISTING_ID = '019abb0c-f621-7a77-93bd-3860dee2a4d3'

console.log('🔍 Verifying Alias Listing\n')
console.log('═══════════════════════════════════════\n')

// 1. Check inventory_alias_links
console.log('1️⃣  Checking inventory_alias_links...')
const { data: link, error: linkError } = await supabase
  .from('inventory_alias_links')
  .select('*')
  .eq('inventory_id', INVENTORY_ID)
  .single()

if (linkError) {
  console.error('❌ Error fetching link:', linkError.message)
} else if (link) {
  console.log('✅ Link found!')
  console.log('   Catalog ID:', link.alias_catalog_id)
  console.log('   Listing ID:', link.alias_listing_id)
  console.log('   Created:', link.created_at)
} else {
  console.log('⚠️  No link found')
}

console.log('\n═══════════════════════════════════════\n')

// 2. Fetch listing from Alias API
if (link?.alias_listing_id) {
  console.log('2️⃣  Fetching listing from Alias API...')
  console.log('   Listing ID:', link.alias_listing_id)

  try {
    const response = await fetch(`${ALIAS_BASE_URL}/listings/${link.alias_listing_id}`, {
      headers: {
        'Authorization': `Bearer ${ALIAS_PAT}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Listing exists on Alias!')
      console.log('   Status:', data.listing.status)
      console.log('   Price:', `$${(data.listing.price_cents / 100).toFixed(2)}`)
      console.log('   Size:', data.listing.size, data.listing.size_unit)
      console.log('   Active:', data.listing.status === 'LISTING_STATUS_ACTIVE')
    } else {
      const text = await response.text()
      console.error('❌ Listing not found on Alias')
      console.error('   Status:', response.status, response.statusText)
      console.error('   Response:', text)
    }
  } catch (error) {
    console.error('❌ Error fetching listing:', error.message)
  }
} else {
  console.log('2️⃣  Skipping Alias API check (no listing_id in database)')
}

console.log('\n═══════════════════════════════════════\n')

// 3. List all your listings on Alias
console.log('3️⃣  Fetching all your Alias listings...')
try {
  const response = await fetch(`${ALIAS_BASE_URL}/listings?limit=10`, {
    headers: {
      'Authorization': `Bearer ${ALIAS_PAT}`,
      'Content-Type': 'application/json',
    },
  })

  if (response.ok) {
    const data = await response.json()
    console.log(`✅ Found ${data.listings?.length || 0} listings`)

    if (data.listings && data.listings.length > 0) {
      console.log('\nYour listings:')
      data.listings.forEach((listing, i) => {
        console.log(`\n${i + 1}. ${listing.catalog_id}`)
        console.log(`   ID: ${listing.id}`)
        console.log(`   Status: ${listing.status}`)
        console.log(`   Price: $${(listing.price_cents / 100).toFixed(2)}`)
        console.log(`   Size: ${listing.size} ${listing.size_unit}`)
      })
    }
  } else {
    console.error('❌ Failed to fetch listings:', response.status, response.statusText)
  }
} catch (error) {
  console.error('❌ Error:', error.message)
}

console.log('\n═══════════════════════════════════════')
console.log('\n✅ Verification complete!')
