#!/usr/bin/env node
/**
 * Poll an old operation that doesn't have a job entry
 * This is for operations created before the job tracking was added
 *
 * Usage: node scripts/poll-old-operation.mjs <operationId> <inventoryItemId>
 */

import { createClient } from '@supabase/supabase-js'

const operationId = process.argv[2]
const inventoryItemId = process.argv[3]

if (!operationId || !inventoryItemId) {
  console.error('❌ Usage: node scripts/poll-old-operation.mjs <operationId> <inventoryItemId>')
  console.error('\nExample:')
  console.error('  node scripts/poll-old-operation.mjs d4228f58-d80c-411f-b1fb-36be631614b3 <your-inventory-item-id>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function pollOldOperation() {
  console.log(`🔍 Polling old operation: ${operationId}`)
  console.log(`📦 For inventory item: ${inventoryItemId}\n`)

  // Get user_id from inventory item
  const { data: item, error: itemError } = await supabase
    .from('inventory')
    .select('user_id')
    .eq('id', inventoryItemId)
    .single()

  if (itemError || !item) {
    console.error('❌ Inventory item not found:', itemError?.message)
    process.exit(1)
  }

  const userId = item.user_id
  console.log(`👤 User ID: ${userId}\n`)

  // Get StockX credentials
  const { data: account, error: accountError } = await supabase
    .from('stockx_accounts')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    console.error('❌ StockX account not found:', accountError?.message)
    process.exit(1)
  }

  console.log('🔑 Found StockX credentials\n')
  console.log('⏳ Polling StockX operation status...\n')

  // Poll StockX API directly
  const response = await fetch(`https://api.stockx.com/v2/operations/${operationId}`, {
    headers: {
      'Authorization': `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`❌ StockX API error: ${response.status} ${response.statusText}`)
    const errorText = await response.text()
    console.error(errorText)
    process.exit(1)
  }

  const operation = await response.json()

  console.log('📊 Operation Status:', operation.status)
  console.log('\n📋 Full Response:')
  console.log(JSON.stringify(operation, null, 2))

  if (operation.status === 'completed' || operation.status === 'partial_success') {
    console.log('\n✅ Operation completed!')

    // Extract listing ID
    const listingId = operation.result?.id || operation.result?.listingId

    if (listingId) {
      console.log(`\n🎉 Listing ID: ${listingId}`)
      console.log(`\n💾 Saving to database...`)

      // Update inventory_market_links
      const { error: linkError } = await supabase
        .from('inventory_market_links')
        .update({
          stockx_listing_id: listingId,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', inventoryItemId)

      if (linkError) {
        console.error('❌ Failed to save listing ID:', linkError.message)
        process.exit(1)
      }

      console.log('✅ Listing ID saved to inventory_market_links!')

      // Verify
      const { data: link } = await supabase
        .from('inventory_market_links')
        .select('stockx_listing_id')
        .eq('item_id', inventoryItemId)
        .single()

      console.log(`\n🔍 Verification: stockx_listing_id = ${link?.stockx_listing_id}`)
    } else {
      console.log('\n⚠️  Warning: No listing ID found in operation result')
      console.log('The result structure might be different than expected.')
    }
  } else if (operation.status === 'failed') {
    console.log('\n❌ Operation failed!')
    if (operation.error) {
      console.log(`Error: ${operation.error.message || JSON.stringify(operation.error)}`)
    }
  } else {
    console.log('\n⏳ Operation still pending')
    console.log('Try running this script again in a few seconds.')
  }
}

pollOldOperation().catch(console.error)
