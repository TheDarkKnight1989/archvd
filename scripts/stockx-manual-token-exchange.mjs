#!/usr/bin/env node
/**
 * Manual StockX Token Exchange
 *
 * This script exchanges an authorization code for access/refresh tokens.
 * Run this AFTER you visit the OAuth URL and get redirected back.
 *
 * Usage:
 *   1. Visit the OAuth URL
 *   2. After authorizing, you'll be redirected to a URL like:
 *      https://archvdio.vercel.app/api/stockx/oauth/callback?code=XXXXX&state=YYYY
 *   3. Copy the 'code' parameter from that URL
 *   4. Run: node scripts/stockx-manual-token-exchange.mjs <code>
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const authCode = process.argv[2]

if (!authCode) {
  console.error('\n❌ Missing authorization code\n')
  console.log('Usage:')
  console.log('  1. Visit the OAuth URL you were given')
  console.log('  2. After authorizing, copy the "code" parameter from the redirect URL')
  console.log('  3. Run: node scripts/stockx-manual-token-exchange.mjs <code>\n')
  process.exit(1)
}

const STOCKX_CLIENT_ID = process.env.STOCKX_CLIENT_ID
const STOCKX_CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET
const REDIRECT_URI = 'https://archvdio.vercel.app/api/stockx/oauth/callback'
const TOKEN_URL = 'https://accounts.stockx.com/oauth/token'

if (!STOCKX_CLIENT_ID || !STOCKX_CLIENT_SECRET) {
  console.error('❌ Missing STOCKX_CLIENT_ID or STOCKX_CLIENT_SECRET in .env.local')
  process.exit(1)
}

console.log('\n🔄 Exchanging authorization code for tokens...\n')

try {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: STOCKX_CLIENT_ID,
      client_secret: STOCKX_CLIENT_SECRET,
      audience: 'gateway.stockx.com',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Token exchange failed: ${response.status}`)
    console.error(`Response: ${errorText}\n`)
    process.exit(1)
  }

  const tokens = await response.json()

  console.log('✅ Successfully obtained tokens!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Add these to your .env.local file:\n')
  console.log(`STOCKX_ACCESS_TOKEN=${tokens.access_token}`)
  console.log(`STOCKX_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('Token details:')
  console.log(`  Type: ${tokens.token_type || 'Bearer'}`)
  console.log(`  Expires in: ${tokens.expires_in || 3600}s (${Math.floor((tokens.expires_in || 3600) / 3600)}h)`)
  console.log(`  Scope: ${tokens.scope || 'offline_access openid'}\n`)

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
