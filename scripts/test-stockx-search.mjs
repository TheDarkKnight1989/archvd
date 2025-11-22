#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STOCKX_API_KEY = process.env.STOCKX_API_KEY || process.env.NEXT_PUBLIC_STOCKX_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', 'fbcde760-820b-4eaf-949f-534a8130d44b')
  .single()

if (!account?.access_token) {
  console.error('No access token found')
  process.exit(1)
}

const styleId = 'AA2261-100'
console.log(`\n🔍 Testing StockX search endpoint for: ${styleId}\n`)

const response = await fetch(`https://api.stockx.com/v2/catalog/search?query=${encodeURIComponent(styleId)}&pageSize=1`, {
  headers: {
    'x-api-key': STOCKX_API_KEY,
    'Authorization': `Bearer ${account.access_token}`,
    'Content-Type': 'application/json',
  }
})

if (!response.ok) {
  console.error(`API error: ${response.status} ${response.statusText}`)
  process.exit(1)
}

const data = await response.json()

console.log('📦 Full response:')
console.log(JSON.stringify(data, null, 2))

if (data.products && data.products.length > 0) {
  const product = data.products[0]
  console.log('\n📸 Image fields in first product:')
  console.log('  media:', product.media)
  console.log('  media.imageUrl:', product.media?.imageUrl)
  console.log('  media.thumbUrl:', product.media?.thumbUrl)
  console.log('  media.smallImageUrl:', product.media?.smallImageUrl)
  console.log('  image:', product.image)
  console.log('  imageUrl:', product.imageUrl)
  console.log('\n✅ Has images:', !!(product.media?.imageUrl || product.image || product.imageUrl))
} else {
  console.log('\n❌ No products found')
}
