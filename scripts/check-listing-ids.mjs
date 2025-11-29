// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

async function check() {
  console.log('=== Checking StockX Listing IDs ===\n')

  // Get all PENDING listings
  const { data: pendingListings, error } = await supabase
    .from('stockx_listings')
    .select('id, stockx_listing_id, stockx_variant_id, status, amount, created_at')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!pendingListings || pendingListings.length === 0) {
    console.log('✅ No PENDING listings found')

    // Check ACTIVE listings
    const { data: activeListings } = await supabase
      .from('stockx_listings')
      .select('id, stockx_listing_id, stockx_variant_id, status, amount, created_at')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(5)

    if (activeListings && activeListings.length > 0) {
      console.log(`Found ${activeListings.length} ACTIVE listings:`)
      console.table(activeListings.map(l => ({
        internal_id: l.id.substring(0, 8),
        stockx_listing_id: l.stockx_listing_id || 'NULL',
        variant_id: l.stockx_variant_id.substring(0, 8),
        status: l.status,
        amount: (l.amount / 100).toFixed(2),
        created: new Date(l.created_at).toLocaleTimeString(),
      })))
    }
  } else {
    console.log(`Found ${pendingListings.length} PENDING listings:`)
    console.table(pendingListings.map(l => ({
      internal_id: l.id.substring(0, 8),
      stockx_listing_id: l.stockx_listing_id || 'NULL',
      variant_id: l.stockx_variant_id.substring(0, 8),
      status: l.status,
      amount: (l.amount / 100).toFixed(2),
      created: new Date(l.created_at).toLocaleTimeString(),
    })))

    console.log('\n⚠️  These listings are still PENDING (no external listing ID yet)')
    console.log('The operation polling worker should update them when StockX confirms.')
  }
}

check().catch(console.error)
