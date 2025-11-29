// @ts-nocheck
/**
 * Sync StockX Listing IDs
 * Fetches all active listings from StockX API and updates local records
 * This backfills missing stockx_listing_id values by matching on variant ID
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

async function getStockxAccessToken(userId) {
  const { data, error } = await supabase
    .from('stockx_accounts')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error(`No StockX account found for user ${userId}`)
  }

  return data.access_token
}

async function fetchStockxListings(accessToken) {
  console.log('Fetching listings from StockX API...')

  const response = await fetch('https://api.stockx.com/v2/selling/listings', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`StockX API error: ${response.status} - ${text}`)
  }

  const data = await response.json()
  return data.data || [] // Array of listings
}

async function syncListings() {
  console.log('=== Syncing StockX Listing IDs ===\n')

  // Get PENDING listings that need syncing
  const { data: pendingListings, error: fetchError } = await supabase
    .from('stockx_listings')
    .select('id, user_id, stockx_listing_id, stockx_variant_id, status, amount, currency_code')
    .eq('status', 'PENDING')
    .is('stockx_listing_id', null)

  if (fetchError) {
    console.error('Error fetching pending listings:', fetchError)
    return
  }

  if (!pendingListings || pendingListings.length === 0) {
    console.log('✅ No pending listings to sync')
    return
  }

  console.log(`Found ${pendingListings.length} pending listings without external IDs\n`)

  // Group by user_id
  const byUser = {}
  for (const listing of pendingListings) {
    if (!byUser[listing.user_id]) {
      byUser[listing.user_id] = []
    }
    byUser[listing.user_id].push(listing)
  }

  let totalSynced = 0
  let totalFailed = 0

  for (const [userId, userListings] of Object.entries(byUser)) {
    console.log(`\n📍 Processing ${userListings.length} listings for user ${userId.substring(0, 8)}...`)

    try {
      // Get access token
      const accessToken = await getStockxAccessToken(userId)

      // Fetch all listings from StockX
      const stockxListings = await fetchStockxListings(accessToken)
      console.log(`   Retrieved ${stockxListings.length} listings from StockX API`)

      // Build lookup map by variant ID
      const stockxByVariant = new Map()
      for (const listing of stockxListings) {
        if (listing.variantId) {
          stockxByVariant.set(listing.variantId, listing)
        }
      }

      // Match and update local listings
      for (const localListing of userListings) {
        const stockxListing = stockxByVariant.get(localListing.stockx_variant_id)

        if (!stockxListing) {
          console.log(`   ⚠️  No StockX listing found for variant ${localListing.stockx_variant_id.substring(0, 8)}`)
          totalFailed++
          continue
        }

        if (!stockxListing.id) {
          console.log(`   ⚠️  StockX listing missing ID for variant ${localListing.stockx_variant_id.substring(0, 8)}`)
          totalFailed++
          continue
        }

        console.log(`   ✅ Matched variant ${localListing.stockx_variant_id.substring(0, 8)} → listing ${stockxListing.id}`)

        // Update local record with external listing ID
        const { error: updateError } = await supabase
          .from('stockx_listings')
          .update({
            stockx_listing_id: stockxListing.id,
            status: 'ACTIVE', // StockX listing exists, so it's active
            updated_at: new Date().toISOString(),
          })
          .eq('id', localListing.id)

        if (updateError) {
          console.error(`   ❌ Failed to update listing:`, updateError.message)
          totalFailed++
          continue
        }

        // Also update inventory_market_links
        const { error: linkError } = await supabase
          .from('inventory_market_links')
          .update({
            stockx_listing_id: stockxListing.id,
            updated_at: new Date().toISOString(),
          })
          .eq('stockx_variant_id', localListing.stockx_variant_id)

        if (linkError) {
          console.warn(`   ⚠️  Failed to update inventory_market_links:`, linkError.message)
        }

        totalSynced++
      }

    } catch (error) {
      console.error(`   ❌ Error processing user ${userId.substring(0, 8)}:`, error.message)
      totalFailed += userListings.length
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`\n📊 Sync Complete:`)
  console.log(`   ✅ Synced: ${totalSynced}`)
  console.log(`   ❌ Failed: ${totalFailed}`)
  console.log()
}

syncListings().catch(console.error)
