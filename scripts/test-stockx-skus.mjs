#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Test these SKUs
const testSkus = ['IO3372-700', 'DC7350-100', 'DZ5485-612']

// Get user ID
const { data: users } = await supabase
  .from('user_stockx_tokens')
  .select('user_id, access_token')
  .limit(1)

if (!users || users.length === 0) {
  console.error('❌ No StockX tokens found')
  process.exit(1)
}

const tokens = users[0]
console.log('Testing SKUs on StockX...\n')

for (const sku of testSkus) {
  console.log(`\n🔍 Testing SKU: ${sku}`)
  console.log('='.repeat(50))

  try {
    const response = await fetch(
      `https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(sku)}&pageSize=5&currencyCode=GBP`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'x-api-key': process.env.STOCKX_API_KEY,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.error(`❌ Search failed: ${response.status}`)
      continue
    }

    const data = await response.json()
    const products = data.products || []

    console.log(`Found ${products.length} products`)

    // Check for exact match
    const exactMatch = products.find(p => p.styleId === sku)

    if (exactMatch) {
      console.log(`✅ EXACT MATCH FOUND`)
      console.log(`  Product ID: ${exactMatch.productId}`)
      console.log(`  Title: ${exactMatch.title}`)
      console.log(`  Style ID: ${exactMatch.styleId}`)
    } else {
      console.log(`❌ NO EXACT MATCH`)
      if (products.length > 0) {
        console.log(`  Closest match:`)
        console.log(`    Style ID: ${products[0].styleId}`)
        console.log(`    Title: ${products[0].title}`)
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
  }
}

console.log('\n' + '='.repeat(50))
console.log('Done!')
