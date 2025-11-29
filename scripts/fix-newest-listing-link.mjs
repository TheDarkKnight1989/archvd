#!/usr/bin/env node
/**
 * Fix the newest listing link (£300 listing created at 3:34 PM)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔧 Fixing newest listing link...\\n')

// The newest listing
const listingId = '3595fd4d-2ee1-43c8-9138-947a9e56d5e7'
const itemId = 'd6bf845c-90da-495c-ad3f-7893172d3534'

console.log(`Listing ID: ${listingId}`)
console.log(`Item ID: ${itemId}\\n`)

const { error } = await supabase
  .from('inventory_market_links')
  .update({ stockx_listing_id: listingId })
  .eq('item_id', itemId)

if (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}

console.log('✅ Successfully updated inventory link!')
console.log('\\n✅ Listing should now be visible in the UI')
