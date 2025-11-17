#!/usr/bin/env node
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CLIENT_ID = process.env.STOCKX_CLIENT_ID
const CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET
const code = process.argv[2]
const callbackUrl = 'https://archvd.com/oauth/callback'

if (!code) {
  console.error('Usage: node exchange-token.mjs <authorization_code>')
  process.exit(1)
}

console.log('🔄 Exchanging authorization code for tokens...\n')

try {
  const tokenResponse = await fetch('https://accounts.stockx.com/oauth/token', {
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

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    console.error(`❌ Token exchange failed (${tokenResponse.status}):`)
    console.error(errorText)
    process.exit(1)
  }

  const tokens = await tokenResponse.json()

  console.log('✅ Successfully obtained tokens!')
  console.log(`\n📋 Token Info:`)
  console.log(`   Type: ${tokens.token_type}`)
  console.log(`   Expires in: ${Math.floor(tokens.expires_in / 3600)} hours`)
  console.log(`   Has refresh token: ${!!tokens.refresh_token}`)

  // Save to .env.local
  const envPath = path.join(__dirname, '..', '.env.local')
  let envContent = ''

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')

    // Remove existing tokens
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('STOCKX_ACCESS_TOKEN=') && !line.startsWith('STOCKX_REFRESH_TOKEN='))
      .join('\n')
  }

  // Add new tokens
  envContent += `\n# StockX OAuth Tokens (expires in ${Math.floor(tokens.expires_in / 3600)} hours)\n`
  envContent += `STOCKX_ACCESS_TOKEN=${tokens.access_token}\n`
  if (tokens.refresh_token) {
    envContent += `STOCKX_REFRESH_TOKEN=${tokens.refresh_token}\n`
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n')

  console.log('\n💾 Saved to .env.local')
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 SUCCESS!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n✅ StockX OAuth tokens are now in .env.local')
  console.log('✅ Restart your dev server to load them:')
  console.log('   npm run dev\n')

} catch (error) {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
}
