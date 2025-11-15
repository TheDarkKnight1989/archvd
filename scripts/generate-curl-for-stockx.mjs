/**
 * Generate exact curl command for StockX support
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

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token
const apiKey = process.env.STOCKX_API_KEY

// Get test variant ID
const productId = '5e6a1e57-1c7d-435a-82bd-5666a13560fe'
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

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('CURL COMMANDS FOR STOCKX SUPPORT')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('Test Product: Nike Dunk Low Retro White Black Panda')
console.log('Product ID:', productId)
console.log('Variant ID:', variantId)
console.log('Size: US M 9')
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('1. WORKING ENDPOINT - Search')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('This command WORKS (returns 200 OK):')
console.log()
console.log(`curl -X GET 'https://api.stockx.com/v2/catalog/search?query=DD1391-100' \\`)
console.log(`  -H 'Authorization: Bearer ${accessToken}' \\`)
console.log(`  -H 'x-api-key: ${apiKey}' \\`)
console.log(`  -H 'Accept: application/json'`)
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('2. WORKING ENDPOINT - GetProduct')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('This command WORKS (returns 200 OK):')
console.log()
console.log(`curl -X GET 'https://api.stockx.com/v2/catalog/products/${productId}' \\`)
console.log(`  -H 'Authorization: Bearer ${accessToken}' \\`)
console.log(`  -H 'x-api-key: ${apiKey}' \\`)
console.log(`  -H 'Accept: application/json'`)
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('3. WORKING ENDPOINT - GetVariants')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('This command WORKS (returns 200 OK):')
console.log()
console.log(`curl -X GET 'https://api.stockx.com/v2/catalog/products/${productId}/variants' \\`)
console.log(`  -H 'Authorization: Bearer ${accessToken}' \\`)
console.log(`  -H 'x-api-key: ${apiKey}' \\`)
console.log(`  -H 'Accept: application/json'`)
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('4. FAILING ENDPOINT - GetVariantMarketData ❌')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('This command FAILS with 403 Forbidden:')
console.log()
console.log(`curl -X GET 'https://api.stockx.com/v2/catalog/variants/${variantId}/market' \\`)
console.log(`  -H 'Authorization: Bearer ${accessToken}' \\`)
console.log(`  -H 'x-api-key: ${apiKey}' \\`)
console.log(`  -H 'Accept: application/json'`)
console.log()
console.log('Response:')
console.log('{"message":"Server error"}')
console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()
console.log('SUMMARY:')
console.log('- OAuth token and API key work for catalog endpoints (search, products, variants)')
console.log('- Same credentials return 403 for market data endpoint')
console.log('- All 40+ endpoint/header variations tested - all return 403')
console.log()
console.log('QUESTION FOR STOCKX:')
console.log('Can you confirm the market data endpoint is accessible with these credentials?')
console.log('Is there additional configuration needed to enable market pricing access?')
console.log()
