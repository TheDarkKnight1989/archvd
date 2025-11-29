// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

const orphanVariantId = '9eff201d-4a3d-4e81-9a2d-0ce66f438066'

async function find() {
  console.log(`Looking for variant ID: ${orphanVariantId}\n`)

  // Check if this variant ID exists in inventory_market_links
  const { data, error } = await supabase
    .from('inventory_market_links')
    .select('item_id, stockx_product_id, stockx_variant_id, stockx_listing_id')
    .eq('stockx_variant_id', orphanVariantId)

  if (error) {
    console.error('Error:', error)
  } else if (!data || data.length === 0) {
    console.log('❌ NOT FOUND in inventory_market_links!')
    console.log('\nThis means the listing was created WITHOUT a corresponding mapping record.')
    console.log('The create listing endpoint should have failed with "NO_MAPPING" error.')
  } else {
    console.log('✅ FOUND in inventory_market_links:')
    console.table(data)
  }

  // Also check the listing itself
  console.log('\nChecking the listing in stockx_listings:')
  const { data: listing } = await supabase
    .from('stockx_listings')
    .select('*')
    .eq('stockx_variant_id', orphanVariantId)
    .single()

  if (listing) {
    console.log('Listing details:')
    console.log('- ID:', listing.id)
    console.log('- Listing ID:', listing.stockx_listing_id || 'NULL')
    console.log('- Product ID:', listing.stockx_product_id)
    console.log('- Variant ID:', listing.stockx_variant_id)
    console.log('- Status:', listing.status)
    console.log('- Amount:', listing.amount / 100)
    console.log('- User ID:', listing.user_id)
    console.log('- Created:', listing.created_at)
  }
}

find().catch(console.error)
