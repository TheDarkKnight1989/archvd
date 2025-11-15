/**
 * Debug size matching between Inventory and StockX prices
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🔍 DEBUGGING SIZE MATCHING\n')

// Get inventory items
const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, size, size_uk, image_url')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])
  .order('created_at')

console.log('INVENTORY:')
inventory?.forEach(item => {
  console.log(`  ${item.sku} | size: "${item.size}" | size_uk: "${item.size_uk}" | image: ${item.image_url ? 'YES' : 'NO'}`)
})

// Get StockX prices
const { data: prices } = await supabase
  .from('stockx_latest_prices')
  .select('*')

console.log('\nSTOCKX PRICES:')
prices?.forEach(price => {
  console.log(`  ${price.sku} | size: "${price.size}" | ask: $${price.lowest_ask}`)
})

// Get market links
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('provider', 'stockx')

console.log('\nMARKET LINKS:')
links?.forEach(link => {
  const inv = inventory?.find(i => i.id === link.inventory_id)
  console.log(`  Inventory: ${inv?.sku} size "${inv?.size}" → StockX: ${link.provider_product_sku}`)
})

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('MATCHING LOGIC:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

inventory?.forEach(item => {
  const link = links?.find(l => l.inventory_id === item.id)
  if (link) {
    const priceKey = `${link.provider_product_sku}:${item.size}`
    const price = prices?.find(p => p.sku === link.provider_product_sku && p.size == item.size)

    console.log(`\n${item.sku}:`)
    console.log(`  Key: "${priceKey}"`)
    console.log(`  Match: ${price ? '✅ $' + price.lowest_ask : '❌ NO MATCH'}`)

    if (!price) {
      // Try alternative matches
      const altPrice = prices?.find(p => p.sku === link.provider_product_sku)
      if (altPrice) {
        console.log(`  Available size: "${altPrice.size}" (inventory has "${item.size}")`)
      }
    }
  }
})
