#!/usr/bin/env node
/**
 * Test Chicago Low Mapping with Fixed Code
 * Tests if HQ6998-600 can be mapped correctly after bug fixes
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CHICAGO_ITEM_ID = '729d9d3d-b9e2-4f1e-8286-e235624b2923' // UK 9

console.log('🧪 Testing Chicago Low mapping with fixed code...\n')

// Get item details
const { data: item } = await supabase
  .from('inventory')
  .select('id, sku, size_uk, user_id')
  .eq('id', CHICAGO_ITEM_ID)
  .single()

if (!item) {
  console.log('❌ Item not found')
  process.exit(1)
}

console.log(`Item: ${item.sku} (Size UK ${item.size_uk})`)
console.log(`Calling mapping API...\n`)

// Call the mapping API endpoint
try {
  const response = await fetch(`http://localhost:3000/api/stockx/map-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: CHICAGO_ITEM_ID
    })
  })

  const result = await response.json()

  if (!response.ok) {
    console.log(`❌ Mapping failed: ${response.status}`)
    console.log(`Error code: ${result.code}`)
    console.log(`Message: ${result.message}\n`)

    if (result.matches) {
      console.log('Search results found:')
      result.matches.forEach((match, i) => {
        console.log(`  ${i + 1}. Product ID: ${match.productId}`)
        console.log(`     Style ID: ${match.styleId}`)
        console.log(`     Title: ${match.title}\n`)
      })
    }

    process.exit(1)
  }

  console.log('✅ Mapping successful!')
  console.log(`Product ID: ${result.productId}`)
  console.log(`Variant ID: ${result.variantId}`)
  console.log(`Product: ${result.product?.title}`)
  console.log(`Size: ${result.variant?.variantValue}\n`)

} catch (error) {
  console.log('❌ Error:', error.message)
  process.exit(1)
}
