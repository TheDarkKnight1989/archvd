#!/usr/bin/env node
/**
 * Check inventory_market_links table with correct schema
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking inventory_market_links table...\n')

// Get all links
const { data: links, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(20)

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

if (!links || links.length === 0) {
  console.log('⚠️  NO rows found in inventory_market_links table')
  console.log('\nThis explains why listings cannot be linked to inventory items!')
  console.log('\n💡 The mapping process (linking inventory items to StockX products)')
  console.log('   must be run BEFORE creating listings.')
  process.exit(0)
}

console.log(`✅ Found ${links.length} inventory market links:\n`)

for (const link of links) {
  console.log(`Item ID: ${link.item_id}`)
  console.log(`  StockX Product: ${link.stockx_product_id || '❌ NOT SET'}`)
  console.log(`  StockX Variant: ${link.stockx_variant_id || '❌ NOT SET'}`)
  console.log(`  Listing ID: ${link.stockx_listing_id || '❌ NOT SET'}`)
  console.log(`  Updated: ${new Date(link.updated_at).toLocaleString()}\n`)
}

// Now check if any of these links match our listings
console.log('=' .repeat(70))
console.log('🔗 Checking if listings have matching links...\n')

const { data: listings } = await supabase
  .from('stockx_listings')
  .select('stockx_listing_id, stockx_product_id, stockx_variant_id')
  .order('created_at', { ascending: false })
  .limit(5)

for (const listing of listings || []) {
  const matchingLink = links.find(
    l =>
      l.stockx_product_id === listing.stockx_product_id &&
      l.stockx_variant_id === listing.stockx_variant_id
  )

  console.log(`Listing ${listing.stockx_listing_id}:`)
  if (matchingLink) {
    console.log(`  ✅ Found matching link (item_id: ${matchingLink.item_id})`)
    if (matchingLink.stockx_listing_id === listing.stockx_listing_id) {
      console.log(`  ✅ Link's listing_id is correctly set`)
    } else if (matchingLink.stockx_listing_id) {
      console.log(`  ⚠️  Link has different listing_id: ${matchingLink.stockx_listing_id}`)
    } else {
      console.log(`  ❌ Link's listing_id is NULL (needs to be updated)`)
    }
  } else {
    console.log(`  ❌ NO matching link found`)
  }
  console.log()
}
