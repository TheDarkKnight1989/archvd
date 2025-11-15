/**
 * Hard Reset - Clean all seed/mock data
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🧹 Starting hard reset...\n')

// Delete market orders
const { count: ordersDeleted } = await supabase
  .from('market_orders')
  .delete()
  .in('provider', ['seed', 'stockx'])
  .select('*', { count: 'exact', head: true })

console.log(`✓ Deleted ${ordersDeleted || 0} market_orders`)

// Delete market prices
const { count: pricesDeleted } = await supabase
  .from('market_prices')
  .delete()
  .in('provider', ['seed', 'stockx'])
  .select('*', { count: 'exact', head: true })

console.log(`✓ Deleted ${pricesDeleted || 0} market_prices`)

// Delete market products
const { count: productsDeleted } = await supabase
  .from('market_products')
  .delete()
  .in('provider', ['seed', 'stockx'])
  .select('*', { count: 'exact', head: true })

console.log(`✓ Deleted ${productsDeleted || 0} market_products`)

// Delete broken inventory (listed with no purchase total)
const { count: inventoryDeleted } = await supabase
  .from('Inventory')
  .delete()
  .eq('status', 'listed')
  .or('purchase_total.is.null,purchase_total.eq.0')
  .select('*', { count: 'exact', head: true })

console.log(`✓ Deleted ${inventoryDeleted || 0} broken Inventory items`)

// Clear inventory market links
const { count: linksDeleted } = await supabase
  .from('inventory_market_links')
  .delete()
  .neq('inventory_id', 'impossible-id')
  .select('*', { count: 'exact', head: true })

console.log(`✓ Deleted ${linksDeleted || 0} inventory_market_links\n`)

// Verify clean state
console.log('📊 Verifying clean state...\n')

const { count: remainingPrices } = await supabase
  .from('market_prices')
  .select('*', { count: 'exact', head: true })

const { count: remainingProducts } = await supabase
  .from('market_products')
  .select('*', { count: 'exact', head: true })

const { count: activeInventory } = await supabase
  .from('Inventory')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active')

const { count: brokenInventory } = await supabase
  .from('Inventory')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'listed')
  .or('purchase_total.is.null,purchase_total.eq.0')

console.log(`  market_prices: ${remainingPrices || 0}`)
console.log(`  market_products: ${remainingProducts || 0}`)
console.log(`  active Inventory: ${activeInventory || 0}`)
console.log(`  broken Inventory: ${brokenInventory || 0}`)

console.log('\n✅ Hard reset complete')
