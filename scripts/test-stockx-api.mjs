/**
 * Test StockX API with correct endpoints and headers
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local first, then .env
dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

console.log('🔍 TESTING STOCKX API ACCESS\n')

// Get OAuth token
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token, expires_at')
  .eq('user_id', userId)
  .single()

if (!account) {
  console.error('❌ No StockX account found')
  process.exit(1)
}

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

console.log('✓ OAuth token:', accessToken.substring(0, 20) + '...')
console.log('✓ API key:', apiKey ? (apiKey.substring(0, 20) + '...') : 'NOT SET')

if (!apiKey) {
  console.warn('⚠️  STOCKX_API_KEY not found in environment - trying without it...')
}

// Test 1: Try gateway.stockx.com (recommended base URL)
console.log('\n📡 Test 1: gateway.stockx.com/api/catalog/search')
try {
  const url = 'https://gateway.stockx.com/api/catalog/search?query=DD1391-100'
  console.log('   URL:', url)

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['x-api-key'] = apiKey

  const response = await fetch(url, { headers })

  console.log('   Status:', response.status, response.statusText)

  if (response.ok) {
    const data = await response.json()
    console.log('   ✅ SUCCESS!')
    console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500))
  } else {
    const text = await response.text()
    console.log('   ❌ Error:', text.substring(0, 200))
  }
} catch (error) {
  console.error('   ❌ Exception:', error.message)
}

// Test 2: Try api.stockx.com (current base URL in env)
console.log('\n📡 Test 2: api.stockx.com/v2/catalog/search')
try {
  const url = 'https://api.stockx.com/v2/catalog/search?query=DD1391-100'
  console.log('   URL:', url)

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (apiKey) headers['x-api-key'] = apiKey

  const response = await fetch(url, { headers })

  console.log('   Status:', response.status, response.statusText)

  if (response.ok) {
    const data = await response.json()
    console.log('   ✅ SUCCESS!')
    console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500))
  } else {
    const text = await response.text()
    console.log('   ❌ Error:', text.substring(0, 200))
  }
} catch (error) {
  console.error('   ❌ Exception:', error.message)
}

// Test 3: Try public API (no auth)
console.log('\n📡 Test 3: stockx.com/api/browse (public)')
try {
  const url = 'https://stockx.com/api/browse?_search=DD1391-100'
  console.log('   URL:', url)

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  })

  console.log('   Status:', response.status, response.statusText)

  if (response.ok) {
    const data = await response.json()
    console.log('   ✅ SUCCESS!')
    console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500))
  } else {
    const text = await response.text()
    console.log('   ❌ Error:', text.substring(0, 200))
  }
} catch (error) {
  console.error('   ❌ Exception:', error.message)
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TEST COMPLETE')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
