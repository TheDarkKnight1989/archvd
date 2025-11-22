/**
 * Test StockX API v2 Search Endpoint
 * Verifies that the v2 catalog/search endpoint works with current credentials
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const STOCKX_API_BASE = process.env.STOCKX_API_BASE_URL || 'https://api.stockx.com'
const STOCKX_API_KEY = process.env.STOCKX_API_KEY

async function testV2Search() {
  console.log('🔍 Testing StockX API v2 Search\n')
  console.log('=' .repeat(60))

  // Get user's StockX tokens from database
  console.log('\n1️⃣  Fetching StockX OAuth tokens from database...')

  const { data: accounts } = await supabase
    .from('stockx_accounts')
    .select('access_token, refresh_token, expires_at')
    .limit(1)

  if (!accounts || accounts.length === 0) {
    console.log('❌ No StockX account found in database')
    console.log('   Please connect StockX account first')
    return
  }

  const account = accounts[0]
  const accessToken = account.access_token
  const expiresAt = new Date(account.expires_at)
  const now = new Date()

  console.log(`✅ Token found`)
  console.log(`   Expires: ${expiresAt.toLocaleString()}`)
  console.log(`   Status: ${expiresAt > now ? '✅ Valid' : '⚠️  Expired'}`)
  console.log(`   Token: ${accessToken.slice(0, 20)}...${accessToken.slice(-10)}`)

  // Test v2 catalog/search endpoint
  console.log('\n2️⃣  Testing v2 catalog/search endpoint...')
  console.log(`   URL: ${STOCKX_API_BASE}/v2/catalog/search`)
  console.log(`   Query: "Nike Dunk"`)
  console.log(`   Has API Key: ${!!STOCKX_API_KEY}`)

  try {
    const url = `${STOCKX_API_BASE}/v2/catalog/search?query=Nike+Dunk&pageNumber=1&pageSize=3`

    console.log(`\n   Making request...`)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': STOCKX_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    console.log(`\n   Response status: ${response.status} ${response.statusText}`)

    const responseText = await response.text()

    if (!response.ok) {
      console.log(`\n❌ API Error:`)
      console.log(`   Status: ${response.status}`)
      console.log(`   Response: ${responseText}`)

      // Check if it's auth issue
      if (response.status === 401 || response.status === 403) {
        console.log(`\n   🔐 Authentication Issue Detected`)
        console.log(`   - Token might be invalid or expired`)
        console.log(`   - API key might be incorrect`)
        console.log(`   - Account might not have API access`)
      }
    } else {
      console.log(`\n✅ SUCCESS! API v2 works!`)

      // Parse and display results
      try {
        const data = JSON.parse(responseText)

        // Debug: show full response structure
        console.log(`\n   Response structure:`)
        console.log(JSON.stringify(data, null, 2).slice(0, 2000))

        const products = data.data || data.results || data.products || []

        console.log(`\n   Found ${products.length} products:`)
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.title || p.name}`)
          console.log(`      SKU: ${p.styleId || p.sku}`)
          console.log(`      Brand: ${p.brand}`)
        })

        if (data.pagination) {
          console.log(`\n   Pagination:`)
          console.log(`      Total: ${data.pagination.total || 'unknown'}`)
          console.log(`      Page: ${data.pagination.page || data.pagination.pageNumber || 1}`)
        }
      } catch (parseError) {
        console.log(`   Parse error:`, parseError.message)
        console.log(`   Raw response: ${responseText.slice(0, 1000)}...`)
      }
    }

  } catch (error) {
    console.log(`\n❌ Request Error:`, error.message)
  }

  console.log('\n' + '='.repeat(60))
}

testV2Search().catch(console.error)
