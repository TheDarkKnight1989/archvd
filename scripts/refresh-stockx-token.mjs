#!/usr/bin/env node
/**
 * Refresh StockX Access Token
 * Uses the refresh token to get a new access token
 */

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const REFRESH_TOKEN = process.env.STOCKX_REFRESH_TOKEN
const CLIENT_ID = process.env.STOCKX_CLIENT_ID
const CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET
const TOKEN_URL = 'https://accounts.stockx.com/oauth/token'

if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing STOCKX_REFRESH_TOKEN, STOCKX_CLIENT_ID, or STOCKX_CLIENT_SECRET')
  process.exit(1)
}

console.log('🔄 Refreshing StockX access token...\n')

try {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: 'gateway.stockx.com',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Token refresh failed: ${response.status}`)
    console.error(`Response: ${errorText}\n`)

    if (response.status === 403 || response.status === 401) {
      console.log('💡 The refresh token may have expired. You need to get a new one via OAuth.\n')
    }

    process.exit(1)
  }

  const tokens = await response.json()

  console.log('✅ Successfully refreshed token!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Update these in your .env.local file:\n')
  console.log(`STOCKX_ACCESS_TOKEN=${tokens.access_token}`)
  if (tokens.refresh_token) {
    console.log(`STOCKX_REFRESH_TOKEN=${tokens.refresh_token}`)
  } else {
    console.log('# Note: No new refresh token provided, keeping existing one')
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('Token details:')
  console.log(`  Type: ${tokens.token_type || 'Bearer'}`)
  console.log(`  Expires in: ${tokens.expires_in || 43200}s (${Math.floor((tokens.expires_in || 43200) / 3600)}h)`)
  console.log(`  Scope: ${tokens.scope || 'offline_access openid'}\n`)

} catch (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}
