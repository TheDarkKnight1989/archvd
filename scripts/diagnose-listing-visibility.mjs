#!/usr/bin/env node
/**
 * Diagnostic script to understand why listings aren't visible in UI
 * Checks:
 * 1. Listings in stockx_listings table
 * 2. inventory_market_links table state
 * 3. Join between tables
 * 4. What the UI hook should be seeing
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
  console.log('🔍 Diagnosing listing visibility issue...\n')
  console.log('=' .repeat(70))

  // Step 1: Check listings in database
  console.log('\n📋 STEP 1: Listings in stockx_listings table')
  console.log('=' .repeat(70))

  const { data: listings, error: listingsError } = await supabase
    .from('stockx_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (listingsError) {
    console.error('❌ Error fetching listings:', listingsError)
    process.exit(1)
  }

  console.log(`Found ${listings.length} listings:\n`)
  listings.forEach((listing, i) => {
    console.log(`${i + 1}. Listing ID: ${listing.stockx_listing_id}`)
    console.log(`   Amount: £${listing.amount / 100}`)
    console.log(`   Status: ${listing.status}`)
    console.log(`   Product: ${listing.stockx_product_id}`)
    console.log(`   Variant: ${listing.stockx_variant_id}`)
    console.log(`   Created: ${new Date(listing.created_at).toLocaleString()}\n`)
  })

  // Step 2: Check inventory_market_links
  console.log('=' .repeat(70))
  console.log('📦 STEP 2: inventory_market_links table state')
  console.log('=' .repeat(70) + '\n')

  const { data: links, error: linksError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('marketplace', 'stockx')
    .order('updated_at', { ascending: false })
    .limit(10)

  if (linksError) {
    console.error('❌ Error fetching links:', linksError)
  } else {
    console.log(`Found ${links.length} StockX inventory links:\n`)
    links.forEach((link, i) => {
      console.log(`${i + 1}. Item ID: ${link.item_id}`)
      console.log(`   Product: ${link.stockx_product_id}`)
      console.log(`   Variant: ${link.stockx_variant_id}`)
      console.log(`   Listing ID: ${link.listing_id || '❌ NOT SET'}`)
      console.log(`   Updated: ${new Date(link.updated_at).toLocaleString()}\n`)
    })
  }

  // Step 3: Cross-reference - which listings have links?
  console.log('=' .repeat(70))
  console.log('🔗 STEP 3: Cross-reference listings with inventory links')
  console.log('=' .repeat(70) + '\n')

  for (const listing of listings) {
    const matchingLink = links?.find(
      link =>
        link.stockx_product_id === listing.stockx_product_id &&
        link.stockx_variant_id === listing.stockx_variant_id
    )

    console.log(`Listing ${listing.stockx_listing_id}:`)
    if (matchingLink) {
      console.log(`  ✅ Has matching link (item_id: ${matchingLink.item_id})`)
      if (matchingLink.listing_id === listing.stockx_listing_id) {
        console.log(`  ✅ Link's listing_id is correctly set`)
      } else if (matchingLink.listing_id) {
        console.log(`  ⚠️  Link's listing_id is SET but DIFFERENT: ${matchingLink.listing_id}`)
      } else {
        console.log(`  ❌ Link's listing_id is NOT SET (NULL)`)
      }
    } else {
      console.log(`  ❌ NO matching link found`)
      console.log(`     Need link with product=${listing.stockx_product_id}, variant=${listing.stockx_variant_id}`)
    }
    console.log()
  }

  // Step 4: Simulate what the UI hook sees
  console.log('=' .repeat(70))
  console.log('👁️  STEP 4: Simulate UI hook query (useStockxListings)')
  console.log('=' .repeat(70) + '\n')

  for (const listing of listings) {
    console.log(`Querying for listing ${listing.stockx_listing_id}...`)

    // This is what the hook does
    const { data: linkData, error: linkError } = await supabase
      .from('inventory_market_links')
      .select(`
        item_id,
        Inventory (
          sku,
          size_uk,
          image_url,
          brand,
          model,
          colorway
        )
      `)
      .eq('stockx_product_id', listing.stockx_product_id)
      .eq('stockx_variant_id', listing.stockx_variant_id)
      .single()

    if (linkError) {
      console.log(`  ❌ Link query failed: ${linkError.message}`)
    } else if (!linkData) {
      console.log(`  ❌ No link data found`)
    } else {
      console.log(`  ✅ Link found: item_id=${linkData.item_id}`)
      if (linkData.Inventory) {
        const inv = linkData.Inventory
        console.log(`  ✅ Inventory: ${inv.brand} ${inv.model} - Size ${inv.size_uk}`)
      } else {
        console.log(`  ⚠️  No inventory data in join`)
      }
    }
    console.log()
  }

  // Step 5: Check for orphaned listings (listings without inventory items)
  console.log('=' .repeat(70))
  console.log('🔍 STEP 5: Check for orphaned listings')
  console.log('=' .repeat(70) + '\n')

  const orphanedCount = listings.filter(listing => {
    const hasLink = links?.some(
      link =>
        link.stockx_product_id === listing.stockx_product_id &&
        link.stockx_variant_id === listing.stockx_variant_id
    )
    return !hasLink
  }).length

  if (orphanedCount > 0) {
    console.log(`⚠️  Found ${orphanedCount} orphaned listings (no inventory item link)`)
    console.log('These listings exist in stockx_listings but have no corresponding inventory item.')
  } else {
    console.log('✅ All listings have corresponding inventory links')
  }

  // Summary
  console.log('\n' + '=' .repeat(70))
  console.log('📊 DIAGNOSIS SUMMARY')
  console.log('=' .repeat(70))
  console.log(`Total listings: ${listings.length}`)
  console.log(`Total inventory links: ${links?.length || 0}`)
  console.log(`Orphaned listings: ${orphanedCount}`)

  const linkedCount = listings.filter(listing =>
    links?.some(
      link =>
        link.stockx_product_id === listing.stockx_product_id &&
        link.stockx_variant_id === listing.stockx_variant_id &&
        link.listing_id === listing.stockx_listing_id
    )
  ).length

  console.log(`Properly linked listings: ${linkedCount}`)
  console.log(`\n💡 Expected UI visibility: ${linkedCount}/${listings.length} listings`)

  if (linkedCount < listings.length) {
    console.log('\n⚠️  ISSUE IDENTIFIED:')
    console.log('Some listings are not properly linked to inventory items.')
    console.log('This prevents them from appearing in the inventory table view.')
    console.log('\n🔧 SOLUTION:')
    console.log('1. Ensure inventory_market_links.listing_id is updated when listing is created')
    console.log('2. Check for errors in link update logic in create/route.ts')
    console.log('3. Verify the listing_id field exists in inventory_market_links table schema')
  }
}

diagnose().catch(console.error)
