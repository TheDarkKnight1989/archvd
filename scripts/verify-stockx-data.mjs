/**
 * Verify StockX market data was stored correctly
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

console.log('📊 VERIFYING STOCKX MARKET DATA\n')

// Get latest StockX prices
const { data: prices, error } = await supabase
  .from('stockx_market_prices')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20)

if (error) {
  console.error('❌ Error fetching prices:', error)
  process.exit(1)
}

console.log(`✓ Found ${prices.length} recent price records\n`)

prices.forEach(price => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`SKU: ${price.sku}`)
  console.log(`Size: ${price.size}`)
  console.log(`Ask: $${price.lowest_ask} | Bid: $${price.highest_bid}`)
  console.log(`Currency: ${price.currency}`)
  console.log(`Source: ${price.source}`)
  console.log(`As of: ${new Date(price.as_of).toLocaleString()}`)
  console.log(`Product ID: ${price.meta?.productId}`)
  console.log(`Variant ID: ${price.meta?.variantId}`)
  console.log()
})

// Check inventory market links
const { data: links } = await supabase
  .from('inventory_market_links')
  .select('*')
  .eq('provider', 'stockx')

console.log(`\n✓ Found ${links?.length || 0} inventory → StockX links`)

links?.forEach(link => {
  console.log(`  ${link.provider_product_sku} → Product: ${link.provider_product_id}`)
})

console.log('\n✅ Verification complete!')
