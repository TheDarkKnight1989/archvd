/**
 * Check what the dashboard will see
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

console.log('📊 DASHBOARD DATA CHECK\n')

// Get inventory (simulating what dashboard does)
const { data: items } = await supabase
  .from('Inventory')
  .select('*')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])
  .order('created_at')

// Get StockX links
const { data: stockxLinks } = await supabase
  .from('inventory_market_links')
  .select('inventory_id, provider_product_sku')
  .eq('provider', 'stockx')

// Get StockX prices
const { data: stockxPrices } = await supabase
  .from('stockx_latest_prices')
  .select('sku, size, lowest_ask, last_sale, as_of')

// Build maps
const stockxLinkMap = new Map()
if (stockxLinks) {
  for (const link of stockxLinks) {
    stockxLinkMap.set(link.inventory_id, {
      product_sku: link.provider_product_sku,
    })
  }
}

const stockxPriceMap = new Map()
if (stockxPrices) {
  for (const price of stockxPrices) {
    const key = `${price.sku}:${price.size}`
    stockxPriceMap.set(key, price)
  }
}

console.log('ITEM | SIZE | SIZE_UK | IMAGE | STOCKX_LINK | PRICE_KEY | MARKET\n')

items?.forEach(item => {
  const stockxLink = stockxLinkMap.get(item.id)
  const matchSize = item.size_uk || item.size
  const priceKey = stockxLink ? `${stockxLink.product_sku}:${matchSize}` : null
  const stockxPrice = priceKey ? stockxPriceMap.get(priceKey) : null

  const hasImage = item.image_url ? '✓' : '✗'
  const hasLink = stockxLink ? '✓' : '✗'
  const market = stockxPrice ? `$${stockxPrice.last_sale}` : '—'

  console.log(
    `${item.sku.padEnd(15)} | ${String(item.size).padEnd(4)} | ${String(item.size_uk).padEnd(7)} | ${hasImage} | ${hasLink} | ${priceKey?.padEnd(20) || 'none'.padEnd(20)} | ${market}`
  )
})

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const withPrices = items?.filter(item => {
  const stockxLink = stockxLinkMap.get(item.id)
  if (!stockxLink) return false
  const matchSize = item.size_uk || item.size
  const priceKey = `${stockxLink.product_sku}:${matchSize}`
  return stockxPriceMap.has(priceKey)
})

console.log(`✅ ${withPrices?.length || 0} items with market prices`)
console.log(`✗ ${(items?.length || 0) - (withPrices?.length || 0)} items WITHOUT market prices`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
