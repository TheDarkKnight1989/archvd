/**
 * Test EVERY possible variation of market data endpoints
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

console.log('🧪 TESTING EVERY MARKET DATA ENDPOINT VARIATION\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

// Get test data
const productId = '5e6a1e57-1c7d-435a-82bd-5666a13560fe' // Nike Dunk Panda
const variantsRes = await fetch(`https://api.stockx.com/v2/catalog/products/${productId}/variants`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

const variants = await variantsRes.json()
const size9Variant = variants.find(v => v.variantValue === '9')
const variantId = size9Variant.variantId

console.log('Test Data:')
console.log('  Product ID:', productId)
console.log('  Variant ID:', variantId)
console.log('  Size:', size9Variant.variantValue)
console.log()

// Test function
async function testEndpoint(name, url, headers) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Testing: ${name}`)
  console.log(`URL: ${url}`)
  console.log(`Headers: ${JSON.stringify(Object.keys(headers))}`)

  try {
    const res = await fetch(url, { headers })
    console.log(`Status: ${res.status} ${res.statusText}`)

    if (res.ok) {
      const data = await res.json()
      console.log('✅ SUCCESS!')
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 800))
      return true
    } else {
      const text = await res.text()
      console.log('❌ Failed:', text.substring(0, 150))
      return false
    }
  } catch (error) {
    console.log('❌ Exception:', error.message)
    return false
  }
}

// Header variations
const headerSets = [
  {
    name: 'OAuth + API Key + JSON',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  },
  {
    name: 'OAuth + API Key only',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
    }
  },
  {
    name: 'OAuth only',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  },
  {
    name: 'API Key only',
    headers: {
      'x-api-key': apiKey,
    }
  },
  {
    name: 'OAuth + User-Agent',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': apiKey,
      'User-Agent': 'archvd-app/1.0',
    }
  },
]

// URL variations for market data
const urlVariations = [
  `https://api.stockx.com/v2/catalog/variants/${variantId}/market`,
  `https://api.stockx.com/v2/catalog/variants/${variantId}/market-data`,
  `https://api.stockx.com/v2/variants/${variantId}/market`,
  `https://api.stockx.com/v2/market/variants/${variantId}`,
  `https://api.stockx.com/v2/catalog/products/${productId}/variants/${variantId}/market`,
  `https://api.stockx.com/catalog/variants/${variantId}/market`,
  `https://gateway.stockx.com/api/catalog/variants/${variantId}/market`,
  `https://gateway.stockx.com/public/v2/catalog/variants/${variantId}/market`,
]

console.log('\n🔍 TESTING URL VARIATIONS\n')

const results = []

for (const url of urlVariations) {
  for (const headerSet of headerSets) {
    const success = await testEndpoint(
      `${url.split('/').slice(-3).join('/')} with ${headerSet.name}`,
      url,
      headerSet.headers
    )

    if (success) {
      results.push({ url, headers: headerSet.name })
      console.log('\n🎉 FOUND A WORKING COMBINATION!')
      console.log('URL:', url)
      console.log('Headers:', headerSet.name)
      break // Found it, stop testing this URL
    }

    await new Promise(r => setTimeout(r, 200)) // Rate limit
  }

  console.log()
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('SUMMARY')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

if (results.length > 0) {
  console.log('✅ WORKING COMBINATIONS:')
  results.forEach(r => {
    console.log(`  ${r.url}`)
    console.log(`  Headers: ${r.headers}`)
  })
} else {
  console.log('❌ NO WORKING COMBINATIONS FOUND')
  console.log('\nThis suggests one of:')
  console.log('  1. The endpoint path is different than expected')
  console.log('  2. Additional authentication is required')
  console.log('  3. The variant ID format is wrong')
  console.log('  4. API permissions need to be configured in StockX portal')
}
