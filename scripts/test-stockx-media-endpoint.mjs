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

const productId = '5bbcafa8-80d2-4eda-b3ac-ad192a3ffdbf'
const endpoints = [
  `/v2/catalog/products/${productId}/media`,
  `/v2/catalog/products/${productId}/images`,
  `/v2/products/${productId}/media`,
]

for (const endpoint of endpoints) {
  console.log(`\n🔍 Testing: ${endpoint}`)

  const response = await fetch(`https://api.stockx.com${endpoint}`, {
    headers: {
      'x-api-key': STOCKX_API_KEY,
      'Authorization': `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
    }
  })

  console.log(`   Status: ${response.status} ${response.statusText}`)

  if (response.ok) {
    const data = await response.json()
    console.log('   ✅ Response:', JSON.stringify(data, null, 2))
  } else {
    const text = await response.text()
    console.log(`   ❌ Error: ${text.substring(0, 100)}`)
  }
}
