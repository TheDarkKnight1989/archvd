#!/usr/bin/env node
/**
 * Test StockX API connectivity
 * Helps diagnose timeout issues
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function testConnection() {
  console.log('🔍 Testing StockX API connectivity...\n')

  // Get a user with StockX account
  const { data: account, error } = await supabase
    .from('stockx_accounts')
    .select('user_id, access_token, expires_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !account) {
    console.error('❌ No StockX accounts found')
    process.exit(1)
  }

  console.log(`👤 Testing with user: ${account.user_id}`)
  console.log(`📅 Token expires: ${account.expires_at}\n`)

  // Test 1: Token endpoint (accounts.stockx.com)
  console.log('Test 1: OAuth Token Endpoint')
  console.log('━'.repeat(60))
  try {
    const tokenStart = Date.now()
    const tokenResponse = await fetch('https://accounts.stockx.com/health', {
      signal: AbortSignal.timeout(10000),
    })
    const tokenDuration = Date.now() - tokenStart
    console.log(`✅ Token endpoint reachable (${tokenDuration}ms)`)
  } catch (err) {
    console.error(`❌ Token endpoint unreachable: ${err.message}`)
  }
  console.log()

  // Test 2: API endpoint (api.stockx.com)
  console.log('Test 2: StockX API Endpoint')
  console.log('━'.repeat(60))
  try {
    const apiStart = Date.now()
    const apiResponse = await fetch('https://api.stockx.com/v2/catalog', {
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
      signal: AbortSignal.timeout(10000),
    })
    const apiDuration = Date.now() - apiStart

    if (apiResponse.ok) {
      console.log(`✅ API endpoint reachable (${apiDuration}ms)`)
      console.log(`   Status: ${apiResponse.status}`)
    } else {
      console.log(`⚠️  API endpoint responded but with error (${apiDuration}ms)`)
      console.log(`   Status: ${apiResponse.status} ${apiResponse.statusText}`)
      const errorText = await apiResponse.text()
      console.log(`   Error: ${errorText.substring(0, 200)}`)
    }
  } catch (err) {
    console.error(`❌ API endpoint unreachable: ${err.message}`)
  }
  console.log()

  // Test 3: Create listing endpoint (the one that's hanging)
  console.log('Test 3: Create Listing Endpoint')
  console.log('━'.repeat(60))
  console.log('Testing POST /v2/selling/listings...')
  try {
    const createStart = Date.now()
    const createResponse = await fetch('https://api.stockx.com/v2/selling/listings', {
      method: 'OPTIONS', // Use OPTIONS to test without creating
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'x-api-key': process.env.STOCKX_API_KEY || '',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    })
    const createDuration = Date.now() - createStart

    console.log(`✅ Create listing endpoint responded (${createDuration}ms)`)
    console.log(`   Status: ${createResponse.status}`)
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.error(`❌ CREATE LISTING ENDPOINT TIMEOUT (>15 seconds)`)
      console.error(`   This is likely why your listings are hanging!`)
    } else {
      console.error(`❌ Create listing endpoint error: ${err.message}`)
    }
  }
  console.log()

  console.log('━'.repeat(60))
  console.log('\n💡 Diagnosis:')
  console.log('   If Test 3 times out, StockX listing endpoint is slow/down.')
  console.log('   Solution: Wait and try again later, or use a longer timeout.')
}

testConnection().catch(console.error)
