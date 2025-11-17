#!/usr/bin/env node
/**
 * StockX OAuth Helper - Get Access Token Manually
 *
 * This helps you complete the OAuth flow manually to get an access token
 * Steps:
 * 1. Start ngrok tunnel
 * 2. Visit authorize URL
 * 3. Login to StockX
 * 4. Get redirected with code
 * 5. Exchange code for token
 */

import 'dotenv/config'
import readline from 'readline'

const CLIENT_ID = process.env.STOCKX_CLIENT_ID
const CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing STOCKX_CLIENT_ID or STOCKX_CLIENT_SECRET in .env.local')
  process.exit(1)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve))
}

console.log('\n🔐 StockX OAuth Token Generator\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('📋 Prerequisites:')
console.log('   1. Install ngrok: brew install ngrok')
console.log('   2. Start your dev server: npm run dev')
console.log('   3. In another terminal, run: ngrok http 3000\n')

async function main() {
  // Step 1: Get ngrok URL
  const ngrokUrl = await ask('Enter your ngrok URL (e.g. https://abc123.ngrok.io): ')

  if (!ngrokUrl.startsWith('https://')) {
    console.error('❌ URL must start with https://')
    process.exit(1)
  }

  const callbackUrl = `${ngrokUrl.replace(/\/$/, '')}/api/stockx/oauth/callback`

  console.log(`\n✅ Callback URL: ${callbackUrl}`)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Step 2: Build authorize URL
  const state = Math.random().toString(36).substring(7)
  const authorizeUrl = new URL('https://accounts.stockx.com/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', CLIENT_ID)
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl)
  authorizeUrl.searchParams.set('scope', 'offline_access openid')
  authorizeUrl.searchParams.set('audience', 'gateway.stockx.com')
  authorizeUrl.searchParams.set('state', state)

  console.log('📝 STEP 1: Update StockX App Settings')
  console.log('   Go to: https://developer.stockx.com')
  console.log('   Navigate to your app settings')
  console.log(`   Set Callback URL to: ${callbackUrl}`)
  console.log('   Save changes\n')

  await ask('Press Enter once you\'ve updated the callback URL...')

  console.log('\n📝 STEP 2: Authorize Your Application')
  console.log('   Copy this URL and open it in your browser:\n')
  console.log(`   ${authorizeUrl.toString()}\n`)
  console.log('   You will:')
  console.log('   1. Be redirected to StockX login page')
  console.log('   2. Login with your StockX credentials')
  console.log('   3. Get redirected back to your ngrok URL')
  console.log('   4. The URL will contain a "code" parameter\n')

  await ask('Press Enter once you\'ve completed the login...')

  console.log('\n📝 STEP 3: Extract Authorization Code')
  console.log('   After login, you were redirected to a URL like:')
  console.log(`   ${callbackUrl}?code=SOME_LONG_CODE&state=${state}\n`)

  const authCode = await ask('Paste the full URL you were redirected to: ')

  // Extract code from URL
  let code
  try {
    const url = new URL(authCode)
    code = url.searchParams.get('code')

    if (!code) {
      console.error('❌ No "code" parameter found in URL')
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Invalid URL')
    process.exit(1)
  }

  console.log(`\n✅ Authorization code: ${code.substring(0, 20)}...\n`)

  // Step 4: Exchange code for token
  console.log('📝 STEP 4: Exchanging code for access token...\n')

  try {
    const response = await fetch('https://accounts.stockx.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: callbackUrl,
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Token exchange failed (${response.status}):`, errorText)
      process.exit(1)
    }

    const tokens = await response.json()

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 SUCCESS! You have your tokens!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('Add these to your .env.local file:\n')
    console.log(`STOCKX_ACCESS_TOKEN=${tokens.access_token}`)
    console.log(`STOCKX_REFRESH_TOKEN=${tokens.refresh_token}\n`)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('📋 Token Info:')
    console.log(`   Type: ${tokens.token_type}`)
    if (tokens.expires_in) {
      const hours = Math.floor(tokens.expires_in / 3600)
      console.log(`   Expires in: ${hours} hours (${tokens.expires_in} seconds)`)
    }
    console.log(`   Scope: ${tokens.scope}`)

    console.log('\n⚠️  IMPORTANT:')
    console.log('   - Access token expires in 12 hours')
    console.log('   - Use the refresh token to get a new access token')
    console.log('   - Refresh token is long-lived with your session\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()
