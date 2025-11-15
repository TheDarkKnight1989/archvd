/**
 * Check Missing Items
 * Identify the items that need market links
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.USER_ID || 'fbcde760-820b-4eaf-949f-534a8130d44b'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMissingItems() {
  // Get all inventory items
  const { data: inventory, error } = await supabase
    .from('Inventory')
    .select('id, sku, size, size_uk, category, brand, model')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  console.log(`📦 Total Active Inventory: ${inventory.length}\n`)

  // Check for items without market links
  const { data: links } = await supabase
    .from('inventory_market_links')
    .select('inventory_id, provider, provider_product_sku')

  const linkedIds = new Set(links?.map(l => l.inventory_id) || [])

  const unlinkedItems = inventory.filter(item => !linkedIds.has(item.id))

  console.log('🔗 Items WITHOUT market links:')
  unlinkedItems.forEach(item => {
    console.log(`  • ${item.sku} (${item.brand} ${item.model})`)
    console.log(`    - Size: ${item.size || 'null'}`)
    console.log(`    - Size UK: ${item.size_uk || 'null'}`)
    console.log(`    - Category: ${item.category || 'null'}`)
    console.log(`    - ID: ${item.id}\n`)
  })

  // Check items with null sizes
  const { data: nullSizeItems } = await supabase
    .from('Inventory')
    .select('id, sku, size, size_uk, brand, model')
    .eq('user_id', userId)
    .eq('status', 'active')
    .or('size.is.null,size_uk.is.null')

  console.log(`\n🔢 Items with NULL or missing sizes:`)
  nullSizeItems?.forEach(item => {
    console.log(`  • ${item.sku} (${item.brand} ${item.model})`)
    console.log(`    - Size: ${item.size || 'null'}`)
    console.log(`    - Size UK: ${item.size_uk || 'null'}`)
    console.log(`    - ID: ${item.id}\n`)
  })
}

checkMissingItems().catch(console.error)
