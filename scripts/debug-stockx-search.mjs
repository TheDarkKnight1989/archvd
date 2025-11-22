#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sku = 'DC7350-100'

console.log(`🔍 Searching StockX for SKU: ${sku}\n`)

// Get user ID (assuming you have one user for testing)
const { data: users } = await supabase
  .from('user_stockx_tokens')
  .select('user_id, access_token')
  .limit(1)

if (!users || users.length === 0) {
  console.error('❌ No StockX tokens found')
  process.exit(1)
}

const tokens = users[0]
console.log('✅ Found tokens\n')

// Make search request
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
  console.error(`❌ Search failed: ${response.status} ${response.statusText}`)
  const text = await response.text()
  console.error(text)
  process.exit(1)
}

const data = await response.json()

console.log('📦 Search results:\n')
console.log(JSON.stringify(data, null, 2))

if (data.products && data.products.length > 0) {
  console.log('\n\n🎯 First product details:')
  const firstProduct = data.products[0]
  console.log('  productId:', firstProduct.productId || firstProduct.id)
  console.log('  styleId:', firstProduct.styleId)
  console.log('  styleID:', firstProduct.styleID)
  console.log('  style_id:', firstProduct.style_id)
  console.log('  title:', firstProduct.title)
  console.log('\n  All keys:', Object.keys(firstProduct))
}
