#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STOCKX_API_KEY = process.env.STOCKX_API_KEY || process.env.NEXT_PUBLIC_STOCKX_API_KEY

if (!STOCKX_API_KEY) {
  console.error('Missing STOCKX_API_KEY or NEXT_PUBLIC_STOCKX_API_KEY')
  process.exit(1)
}

// Get access token from stockx_accounts table
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

console.log(`Fetching product: ${productId}`)

const response = await fetch(`https://api.stockx.com/v2/catalog/products/${productId}`, {
  headers: {
    'x-api-key': STOCKX_API_KEY,
    'Authorization': `Bearer ${account.access_token}`,
    'Content-Type': 'application/json',
  }
})

if (!response.ok) {
  console.error(`API error: ${response.status} ${response.statusText}`)
  const text = await response.text()
  console.error(text)
  process.exit(1)
}

const data = await response.json()

// Write to file
fs.writeFileSync('/tmp/stockx-raw-response.json', JSON.stringify(data, null, 2))

console.log('\n✅ Raw API response saved to /tmp/stockx-raw-response.json')
console.log('\n📸 IMAGE FIELDS:')
console.log('  media:', data.media)
console.log('  media.imageUrl:', data.media?.imageUrl)
console.log('  media.thumbUrl:', data.media?.thumbUrl)
console.log('  media.smallImageUrl:', data.media?.smallImageUrl)
console.log('  imageUrl exists:', !!data.media?.imageUrl)
