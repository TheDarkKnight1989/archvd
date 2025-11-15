/**
 * Add seed market prices so portfolio shows estimated values
 * Uses reasonable market estimates based on current sneaker market
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

// Reasonable market price estimates (GBP) based on current market
const MARKET_PRICES = {
  'DZ5485-612': { size: '10', last_sale: 165, ask: 170, bid: 160 }, // Jordan 1 Lucky Green
  'AA2261-100': { size: '10.5', last_sale: 850, ask: 900, bid: 800 }, // Mars Yard 2.0 (high value)
  'FD9082-102': { size: '8', last_sale: 95, ask: 100, bid: 90 }, // AF1 White
  'DD1391-100': { size: '9', last_sale: 110, ask: 115, bid: 105 }, // Dunk Panda
  'DZ5485-410': { size: '10', last_sale: 280, ask: 300, bid: 270 }, // Dunk Pikachu (premium)
  'DC7350-100': { size: '9', last_sale: 145, ask: 150, bid: 140 }, // Jordan 1 Low Grey
  'M2002RDA': { size: '11.5', last_sale: 140, ask: 145, bid: 135 }, // NB 2002R
  '3MD10251539': { size: '11', last_sale: 155, ask: 160, bid: 150 }, // On Cloudmonster
  'HQ6316': { size: '11', last_sale: 80, ask: 85, bid: 75 }, // Yeezy Slide
  'DN4575-200': { size: '7', last_sale: 750, ask: 800, bid: 720 }, // Travis Scott AM1 (high value)
}

console.log('💰 ADDING SEED MARKET PRICES\n')

const { data: inventory } = await supabase
  .from('Inventory')
  .select('id, sku, size_uk')
  .eq('user_id', userId)
  .in('status', ['active', 'listed', 'worn'])

let created = 0
let skipped = 0

for (const item of inventory || []) {
  const priceData = MARKET_PRICES[item.sku]

  if (!priceData) {
    console.log(`⊘ No price data for ${item.sku}`)
    skipped++
    continue
  }

  // Insert into market_prices table
  const { error } = await supabase
    .from('market_prices')
    .insert({
      provider: 'seed',
      sku: item.sku,
      size_uk: priceData.size,
      currency: 'GBP',
      last_sale: priceData.last_sale,
      ask: priceData.ask,
      bid: priceData.bid,
      as_of: new Date().toISOString(),
      meta: {
        source: 'seed-data',
        note: 'Market estimate for testing',
      },
    })

  if (error) {
    if (error.message?.includes('duplicate')) {
      console.log(`⊘ ${item.sku}: Price already exists`)
      skipped++
    } else {
      console.error(`❌ ${item.sku}:`, error.message)
    }
  } else {
    const gain = priceData.last_sale - (item.purchase_price || 0)
    const gainPct = item.purchase_price ? ((gain / item.purchase_price) * 100).toFixed(1) : '0'
    console.log(`✅ ${item.sku}: £${priceData.last_sale} (${gain >= 0 ? '+' : ''}${gainPct}%)`)
    created++
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  PRICES ADDED`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Created: ${created}`)
console.log(`  Skipped: ${skipped}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

console.log(`📌 Reload http://localhost:3000/portfolio/inventory to see prices`)
