#!/usr/bin/env node
/**
 * Get StockX Access Token using Client Credentials
 *
 * This script exchanges your Client ID + Client Secret for an access token
 * that can be used to make StockX API calls.
 */

import 'dotenv/config'

const STOCKX_AUTH_URL = process.env.STOCKX_API_BASE_URL || 'https://api.stockx.com'
const CLIENT_ID = process.env.STOCKX_CLIENT_ID
const CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET

async function getAccessToken() {
  console.log('🔐 Getting StockX Access Token...\n')

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ ERROR: Missing credentials')
    console.error('   Please set STOCKX_CLIENT_ID and STOCKX_CLIENT_SECRET in .env.local')
    process.exit(1)
  }

  console.log('📋 Config:')
  console.log(`   Auth URL: ${STOCKX_AUTH_URL}`)
  console.log(`   Client ID: ${CLIENT_ID.substring(0, 8)}...`)
  console.log(`   Client Secret: ${CLIENT_SECRET.substring(0, 8)}...\n`)

  try {
    // Method 1: Try OAuth2 Client Credentials flow
    console.log('🔄 Attempting Method 1: Client Credentials Grant...')

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })

    const response = await fetch(`${STOCKX_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    if (response.ok) {
      const data = await response.json()

      console.log('\n✅ SUCCESS! Got access token:\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('Add this to your .env.local file:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      console.log(`STOCKX_ACCESS_TOKEN=${data.access_token}\n`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      if (data.expires_in) {
        const expiresInHours = Math.floor(data.expires_in / 3600)
        console.log(`⏰ Token expires in: ${expiresInHours} hours (${data.expires_in} seconds)`)
      }

      if (data.token_type) {
        console.log(`📝 Token type: ${data.token_type}`)
      }

      console.log('\n🎉 You can now use the StockX API!')
      return
    }

    // Method 1 failed - show error and try alternative
    const errorText = await response.text()
    let errorData

    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { message: errorText }
    }

    console.log(`   ❌ Failed (${response.status}): ${errorData.error || errorData.message}\n`)

    // Method 2: Try Basic Auth
    console.log('🔄 Attempting Method 2: Basic Authentication...')

    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

    const response2 = await fetch(`${STOCKX_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials',
    })

    if (response2.ok) {
      const data = await response.json()

      console.log('\n✅ SUCCESS! Got access token:\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('Add this to your .env.local file:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      console.log(`STOCKX_ACCESS_TOKEN=${data.access_token}\n`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      console.log('\n🎉 You can now use the StockX API!')
      return
    }

    const error2Text = await response2.text()
    console.log(`   ❌ Failed (${response2.status}): ${error2Text}\n`)

    // Both methods failed
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('❌ BOTH METHODS FAILED')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('This likely means your StockX app is configured for OAuth User Flow')
    console.log('rather than Client Credentials flow.\n')

    console.log('📝 SOLUTIONS:\n')
    console.log('1. **Check StockX Developer Portal**')
    console.log('   - Go to https://developer.stockx.com')
    console.log('   - Check if there\'s a "Generate Token" or "API Token" button')
    console.log('   - Some portals provide test tokens directly\n')

    console.log('2. **Contact StockX Support**')
    console.log('   - Ask them to enable "Client Credentials" grant type')
    console.log('   - Or ask for a manual access token for testing\n')

    console.log('3. **Use OAuth User Flow (requires production domain)**')
    console.log('   - Deploy to production')
    console.log('   - Set redirect URL to https://yourdomain.com/api/stockx/oauth/callback')
    console.log('   - User authorization flow will work\n')

    console.log('4. **Check Documentation**')
    console.log('   - Look for "Authentication" section in StockX docs')
    console.log('   - They may have specific instructions for getting tokens\n')

    process.exit(1)

  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

getAccessToken()
