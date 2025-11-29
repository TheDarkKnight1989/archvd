#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const { data: links } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_listing_id, stockx_variant_id, updated_at')
  .not('stockx_listing_id', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(5)

console.log('Items with listing IDs in inventory_market_links:')
links?.forEach(l => console.log(`- Item ${l.item_id}: Listing ${l.stockx_listing_id}`))
