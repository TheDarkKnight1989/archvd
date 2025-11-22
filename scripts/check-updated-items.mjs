#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USER_ID = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('Checking updated inventory items...\n')

const { data: items, error } = await supabase
  .from('Inventory')
  .select('id, sku, size_uk, custom_market_value, updated_at')
  .eq('user_id', USER_ID)
  .in('status', ['active', 'listed', 'worn'])
  .order('updated_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log(`Found ${items.length} recent items:\n`)
items.forEach(item => {
  console.log(`SKU: ${item.sku}`)
  console.log(`  Size: UK ${item.size_uk}`)
  console.log(`  Market Value: ${item.custom_market_value !== null ? '£' + item.custom_market_value : 'NULL'}`)
  console.log(`  Updated: ${new Date(item.updated_at).toLocaleString()}\n`)
})
