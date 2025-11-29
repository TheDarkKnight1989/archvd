// @ts-nocheck
/**
 * Diagnostic script to check why pending listings aren't appearing
 * Traces the entire flow from stockx_listings to useInventoryV3
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function diagnose() {
  console.log('=== DIAGNOSTIC: Pending Listings Investigation ===\n')

  // Step 1: Check recent listings in stockx_listings
  console.log('1️⃣  Recent listings in stockx_listings:')
  const { data: listings, error: listingsError } = await supabase
    .from('stockx_listings')
    .select('id, stockx_listing_id, stockx_variant_id, status, amount, currency_code, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (listingsError) {
    console.error('Error fetching listings:', listingsError)
  } else {
    console.table(listings.map(l => ({
      id: l.id.substring(0, 8),
      listing_id: l.stockx_listing_id || 'NULL',
      variant_id: l.stockx_variant_id,
      status: l.status,
      amount: l.amount,
      created_at: new Date(l.created_at).toLocaleTimeString(),
    })))
  }

  // Step 2: Check inventory_market_links
  console.log('\n2️⃣  Inventory items with StockX mappings:')
  const { data: mappings, error: mappingsError } = await supabase
    .from('inventory_market_links')
    .select(`
      item_id,
      stockx_variant_id,
      stockx_listing_id,
      Inventory!inner(sku, brand, model)
    `)
    .not('stockx_variant_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (mappingsError) {
    console.error('Error fetching mappings:', mappingsError)
  } else {
    console.table(mappings.map(m => ({
      item_id: m.item_id.substring(0, 8),
      sku: m.Inventory.sku,
      brand: m.Inventory.brand,
      model: m.Inventory.model,
      variant_id: m.stockx_variant_id,
      listing_id: m.stockx_listing_id || 'NULL',
    })))
  }

  // Step 3: Cross-reference - find listings without matching in inventory_market_links
  console.log('\n3️⃣  Listings NOT linked to inventory_market_links:')
  if (listings && listings.length > 0) {
    const variantIdsInListings = listings
      .map(l => l.stockx_variant_id)
      .filter(Boolean)

    const variantIdsInMappings = mappings
      ?.map(m => m.stockx_variant_id)
      .filter(Boolean) || []

    const orphanedVariantIds = variantIdsInListings.filter(
      vid => !variantIdsInMappings.includes(vid)
    )

    if (orphanedVariantIds.length > 0) {
      console.log('❌ FOUND ORPHANED LISTINGS!')
      console.log('These variant IDs are in stockx_listings but NOT in inventory_market_links:')
      orphanedVariantIds.forEach(vid => {
        const listing = listings.find(l => l.stockx_variant_id === vid)
        console.log(`  - ${vid} (status: ${listing.status}, user_id: ${listing.user_id})`)
      })
    } else {
      console.log('✅ All listing variant IDs exist in inventory_market_links')
    }
  }

  // Step 4: Simulate useInventoryV3 variant ID fallback query
  console.log('\n4️⃣  Simulating useInventoryV3 variant ID fallback:')

  if (mappings && mappings.length > 0) {
    // Get variant IDs for items without listing IDs (this is what useInventoryV3 does)
    const variantIdsToQuery = mappings
      .filter(m => !m.stockx_listing_id && m.stockx_variant_id)
      .map(m => m.stockx_variant_id)

    console.log(`Found ${variantIdsToQuery.length} items without listing IDs`)
    console.log('Variant IDs to query:', variantIdsToQuery)

    if (variantIdsToQuery.length > 0) {
      const { data: pendingListings, error: pendingError } = await supabase
        .from('stockx_listings')
        .select('id, stockx_listing_id, stockx_variant_id, amount, currency_code, status, expires_at')
        .in('stockx_variant_id', variantIdsToQuery)
        .eq('status', 'PENDING')

      if (pendingError) {
        console.error('Error in variant ID fallback query:', pendingError)
      } else {
        console.log(`✅ Found ${pendingListings?.length || 0} PENDING listings by variant ID`)
        if (pendingListings && pendingListings.length > 0) {
          console.table(pendingListings.map(l => ({
            id: l.id.substring(0, 8),
            variant_id: l.stockx_variant_id,
            status: l.status,
            amount: l.amount,
          })))
        }
      }
    }
  }

  // Step 5: Check for RLS issues
  console.log('\n5️⃣  Testing with user context (simulating client-side query):')

  // Get a user ID from recent listings
  if (listings && listings.length > 0 && listings[0].user_id) {
    const testUserId = listings[0].user_id
    console.log(`Testing with user_id: ${testUserId}`)

    // This simulates what the client-side code sees
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'X-Test-User-Id': testUserId
        }
      }
    })

    const { data: userListings, error: userError } = await supabaseClient
      .from('stockx_listings')
      .select('id, stockx_listing_id, stockx_variant_id, status')
      .order('created_at', { ascending: false })
      .limit(3)

    if (userError) {
      console.error('❌ RLS might be filtering data:', userError)
    } else {
      console.log(`✅ User can see ${userListings?.length || 0} listings`)
    }
  }
}

diagnose().catch(console.error)
