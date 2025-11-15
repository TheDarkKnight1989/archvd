/**
 * Debug product API response to see where images come from
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
const apiKey = process.env.STOCKX_API_KEY

console.log('🔍 DEBUGGING PRODUCT API RESPONSE\n')

// Get credentials
const { data: account } = await supabase
  .from('stockx_accounts')
  .select('access_token')
  .eq('user_id', userId)
  .single()

const accessToken = account.access_token

// Test with Nike Dunk Panda
const productId = '5e6a1e57-1c7d-435a-82bd-5666a13560fe'

console.log('Testing with Nike Dunk Panda')
console.log('Product ID:', productId)
console.log()

// Get product details
const productUrl = `https://api.stockx.com/v2/catalog/products/${productId}`

const productRes = await fetch(productUrl, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': apiKey,
    'Accept': 'application/json',
  },
})

if (!productRes.ok) {
  console.error('❌ Failed:', productRes.status)
  process.exit(1)
}

const productData = await productRes.json()

console.log('Full response:')
console.log(JSON.stringify(productData, null, 2))
