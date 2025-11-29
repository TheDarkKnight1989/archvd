#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
  .from('stockx_listings')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('Error:', error)
} else {
  console.log(`\n✅ Found ${data.length} listings in database:\n`)
  data.forEach((listing, i) => {
    console.log(`${i + 1}. ID: ${listing.stockx_listing_id}`)
    console.log(`   Amount: £${listing.amount / 100}`)
    console.log(`   Status: ${listing.status}`)
    console.log(`   Created: ${new Date(listing.created_at).toLocaleString()}`)
    console.log(`   Product ID: ${listing.stockx_product_id}`)
    console.log(`   Variant ID: ${listing.stockx_variant_id}\n`)
  })
}
