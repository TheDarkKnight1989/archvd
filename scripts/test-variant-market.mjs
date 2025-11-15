/**
 * Test GetVariant and GetVariantMarketData endpoints
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🧪 TESTING VARIANT AND MARKET ENDPOINTS\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

// Get variants for Nike Dunk Panda
const productId = '5e6a1e57-1c7d-435a-82bd-5666a13560fe'
const variantsUrl = `https://api.stockx.com/v2/catalog/products/${productId}/variants`

console.log('Fetching variants...')
const variantsRes = await fetch(variantsUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

if (!variantsRes.ok) {
  console.error('Failed to get variants:', variantsRes.status)
  process.exit(1)
}

const variants = await variantsRes.json()
console.log(`✓ Got ${variants.length} variants\n`)

// Find size 9 (US M)
const size9 = variants.find(v =>
  v.variantValue === '9' ||
  v.sizeChart?.defaultConversion?.size === '9'
)

if (!size9) {
  console.error('Could not find size 9')
  console.log('Available sizes:', variants.map(v => v.variantValue).join(', '))
  process.exit(1)
}

console.log('✓ Found size 9 variant')
console.log('  Variant ID:', size9.variantId)
console.log('  Variant name:', size9.variantName)
console.log('  Size value:', size9.variantValue)
console.log()

// Test 1: GetVariant
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📡 TEST 1: GetVariant')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const variantUrl = `https://api.stockx.com/v2/catalog/variants/${size9.variantId}`
console.log('URL:', variantUrl)

const variantRes = await fetch(variantUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

console.log('Status:', variantRes.status, variantRes.statusText)

if (variantRes.ok) {
  const variantData = await variantRes.json()
  console.log('✅ SUCCESS!')
  console.log('Response:', JSON.stringify(variantData, null, 2).substring(0, 600))
} else {
  const text = await variantRes.text()
  console.log('❌ FAILED:', text.substring(0, 200))
}

// Test 2: GetVariantMarketData
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📡 TEST 2: GetVariantMarketData (THE IMPORTANT ONE)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const marketUrl = `https://api.stockx.com/v2/catalog/variants/${size9.variantId}/market`
console.log('URL:', marketUrl)

const marketRes = await fetch(marketUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

console.log('Status:', marketRes.status, marketRes.statusText)

if (marketRes.ok) {
  const marketData = await marketRes.json()
  console.log('✅ SUCCESS! MARKET DATA AVAILABLE!')
  console.log()
  console.log('Full market response:')
  console.log(JSON.stringify(marketData, null, 2))
} else {
  const text = await marketRes.text()
  console.log('❌ FAILED:', text.substring(0, 200))
}
