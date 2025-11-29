// @ts-nocheck
/**
 * Simulates useInventoryV3 hook to debug why listing isn't appearing
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Use ANON key like client does

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

const targetItemId = 'd6886554-dff3-43dd-b3d3-93318e2bcc09'
const targetVariantId = '9eff201d-4a3d-4e81-9a2d-0ce66f438066'

async function simulate() {
  console.log('=== SIMULATING useInventoryV3 ===\n')
  console.log(`Target Item ID: ${targetItemId}`)
  console.log(`Target Variant ID: ${targetVariantId}\n`)

  // Step 1: Fetch inventory items
  console.log('STEP 1: Fetch inventory items')
  const { data: inventory, error: inventoryError } = await supabase
    .from('Inventory')
    .select('*')
    .eq('id', targetItemId)
    .single()

  if (inventoryError) {
    console.error('❌ Failed to fetch inventory:', inventoryError)
    return
  }
  console.log('✅ Found inventory item:', inventory.sku)

  // Step 2: Fetch StockX mapping
  console.log('\nSTEP 2: Fetch StockX mapping')
  const { data: stockxMappings, error: mappingError } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', targetItemId)

  if (mappingError) {
    console.error('❌ Failed to fetch mapping:', mappingError)
    return
  }
  console.log('✅ Found mapping:', stockxMappings?.length || 0, 'records')
  if (stockxMappings && stockxMappings.length > 0) {
    console.log('   Mapping details:', {
      variant_id: stockxMappings[0].stockx_variant_id,
      listing_id: stockxMappings[0].stockx_listing_id,
    })
  }

  // Step 3: Collect variant IDs for items without listing IDs
  console.log('\nSTEP 3: Collect variant IDs for fallback query')
  const variantIds = stockxMappings
    ?.filter(m => m.stockx_variant_id && !m.stockx_listing_id)
    .map(m => m.stockx_variant_id)
    .filter(Boolean) || []

  console.log('Variant IDs without listing IDs:', variantIds)

  // Step 4: Query stockx_listings by variant ID
  console.log('\nSTEP 4: Query stockx_listings by variant ID')
  if (variantIds.length > 0) {
    const { data: listings, error: listingsError } = await supabase
      .from('stockx_listings')
      .select('id, stockx_listing_id, stockx_variant_id, amount, currency_code, status, expires_at')
      .in('stockx_variant_id', variantIds)
      .eq('status', 'PENDING')

    if (listingsError) {
      console.error('❌ Failed to query listings:', listingsError)
      return
    }

    console.log(`✅ Found ${listings?.length || 0} PENDING listings`)
    if (listings && listings.length > 0) {
      console.table(listings.map(l => ({
        id: l.id.substring(0, 8),
        listing_id: l.stockx_listing_id || 'NULL',
        variant_id: l.stockx_variant_id.substring(0, 8),
        status: l.status,
        amount: l.amount,
      })))
    } else {
      console.log('❌ NO PENDING LISTINGS FOUND!')
      console.log('\nChecking if listing exists with different status...')

      const { data: anyListings } = await supabase
        .from('stockx_listings')
        .select('id, stockx_listing_id, stockx_variant_id, amount, status')
        .in('stockx_variant_id', variantIds)

      if (anyListings && anyListings.length > 0) {
        console.log('⚠️  Found listings but with different status:')
        console.table(anyListings.map(l => ({
          id: l.id.substring(0, 8),
          listing_id: l.stockx_listing_id || 'NULL',
          status: l.status,
          amount: l.amount,
        })))
      }
    }
  } else {
    console.log('⚠️  No variant IDs to query (item has listing_id already?)')
  }

  // Step 5: Check RLS
  console.log('\nSTEP 5: Check RLS permissions')
  console.log('Testing with ANON key (same as client-side)...')

  const { count, error: countError } = await supabase
    .from('stockx_listings')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ RLS might be blocking access:', countError)
  } else {
    console.log(`✅ Can see ${count} total listings with ANON key`)
  }
}

simulate().catch(console.error)
