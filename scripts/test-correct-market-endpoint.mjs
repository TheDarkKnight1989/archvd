/**
 * Test the CORRECT market data endpoint from StockX support
 * Endpoint: /v2/catalog/products/{productId}/variants/{variantId}/market-data
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

console.log('🧪 TESTING CORRECT MARKET DATA ENDPOINT\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

// Test with Nike Dunk Panda
const productId = '5e6a1e57-1c7d-435a-82bd-5666a13560fe'

// Get variants
console.log('Getting variants...')
const variantsRes = await fetch(
  `https://api.stockx.com/v2/catalog/products/${productId}/variants`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
  }
)

const variants = await variantsRes.json()
const size9Variant = variants.find(v => v.variantValue === '9')
const variantId = size9Variant.variantId

console.log('✓ Product ID:', productId)
console.log('✓ Variant ID:', variantId)
console.log('✓ Size:', size9Variant.variantValue)
console.log()

// Test CORRECT endpoint
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📡 TESTING CORRECT ENDPOINT')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const correctUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variantId}/market-data`
console.log('URL:', correctUrl)
console.log()

const marketRes = await fetch(correctUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

console.log('Status:', marketRes.status, marketRes.statusText)
console.log()

if (marketRes.ok) {
  const marketData = await marketRes.json()
  console.log('✅ SUCCESS! MARKET DATA WORKING!')
  console.log()
  console.log('Market Data Response:')
  console.log(JSON.stringify(marketData, null, 2))
} else {
  const text = await marketRes.text()
  console.log('❌ FAILED')
  console.log('Response:', text)
}
