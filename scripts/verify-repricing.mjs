/**
 * Verify if repricing was applied
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
  console.log('🔍 Checking if repricing was applied\n')

  const { data: users } = await supabase.from('Inventory').select('user_id').limit(1)
  const userId = users[0].user_id

  // Get the aged items
  const { data: inventory } = await supabase
    .from('Inventory')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'listed', 'worn'])

  const now = new Date()
  const aged = inventory.filter(item => {
    const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
    const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 30
  })

  console.log('Items > 30 days old:\n')
  for (const item of aged) {
    const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
    const days = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))

    console.log(`SKU: ${item.sku}`)
    console.log(`  Days old: ${days}`)
    console.log(`  Purchase price: £${item.purchase_price}`)
    console.log(`  Tax: £${item.tax || 0}`)
    console.log(`  Shipping: £${item.shipping || 0}`)
    console.log(`  Total cost: £${item.purchase_price + (item.tax || 0) + (item.shipping || 0)}`)
    console.log(`  custom_market_value: ${item.custom_market_value ? '£' + item.custom_market_value : 'NULL (not set)'}`)
    console.log(`  Last updated: ${item.updated_at}`)
    console.log()
  }

  // Check if custom_market_value was set
  const repricedItems = aged.filter(i => i.custom_market_value !== null)

  if (repricedItems.length > 0) {
    console.log(`✅ ${repricedItems.length} item(s) have custom_market_value set`)
  } else {
    console.log(`❌ No items have custom_market_value set - repricing may not have worked`)
  }
}

verify()
