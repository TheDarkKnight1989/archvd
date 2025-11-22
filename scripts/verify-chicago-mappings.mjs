#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/ritesh/Projects/archvd/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('Checking Chicago mappings...\n')

const { data: mappings, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .in('item_id', [
    '729d9d3d-b9e2-4f1e-8286-e235624b2923',
    '85a1fbbd-b271-4961-b65b-4d862ec2ac23'
  ])

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log(`Found ${mappings.length} mapping(s):\n`)
mappings.forEach(m => {
  console.log(`- Item: ${m.item_id}`)
  console.log(`  Product: ${m.stockx_product_id}`)
  console.log(`  Variant: ${m.stockx_variant_id}\n`)
})
