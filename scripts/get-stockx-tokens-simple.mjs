#!/usr/bin/env node
/**
 * Simple StockX OAuth Token Getter
 *
 * This script helps you get StockX OAuth tokens manually:
 * 1. Prints the authorize URL
 * 2. You open it and login
 * 3. You paste back the redirect URL
 * 4. Script extracts code and gets tokens
 * 5. Saves to .env.local
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

console.log('\n🔐 StockX OAuth Token Generator (Simple)\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

async function main() {
  try {
    // Use a dummy callback URL that we control
    const callbackUrl = 'https://archvd.com/oauth/callback'

    console.log('📝 STEP 1: Set StockX Callback URL\n')
    console.log('   Go to: https://developer.stockx.com')
    console.log('   Set callback URL to: ' + callbackUrl)
    console.log('   (You can use any URL you control, or even a fake one)')
    console.log()

    await ask('Press Enter once you\'ve set the callback URL...')

    // Build authorize URL
    const state = Math.random().toString(36).substring(7)
    const authorizeUrl = new URL('https://accounts.stockx.com/authorize')
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', CLIENT_ID)
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl)
    authorizeUrl.searchParams.set('scope', 'offline_access openid')
    authorizeUrl.searchParams.set('audience', 'gateway.stockx.com')
    authorizeUrl.searchParams.set('state', state)

    console.log('\n📝 STEP 2: Authorize the Application\n')
    console.log('   Open this URL in your browser:\n')
    console.log('   ' + authorizeUrl.toString())
    console.log()
    console.log('   After logging in, you\'ll be redirected to a URL like:')
    console.log('   ' + callbackUrl + '?code=XXXXX&state=' + state)
    console.log()
    console.log('   The page might show an error (that\'s okay!)')
    console.log('   Just copy the FULL URL from your browser\'s address bar.')
    console.log()

    const redirectUrl = await ask('Paste the full redirect URL here: ')

    // Extract code from URL
    let code
    try {
      const url = new URL(redirectUrl.trim())
      code = url.searchParams.get('code')

      if (!code) {
        console.error('\n❌ No "code" parameter found in URL')
        console.log('Make sure you copied the full URL including ?code=...')
        process.exit(1)
      }
    } catch (err) {
      console.error('\n❌ Invalid URL')
      console.log('Make sure you pasted the full URL from the browser')
      process.exit(1)
    }

    console.log(`\n✅ Got authorization code: ${code.substring(0, 20)}...`)
    console.log('\n🔄 Exchanging code for tokens...\n')

    // Exchange code for tokens
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
      console.error(`\n❌ Token exchange failed (${tokenResponse.status}):`)
      console.error(errorText)
      process.exit(1)
    }

    const tokens = await tokenResponse.json()

    // Save to .env.local
    const envPath = path.join(__dirname, '..', '.env.local')

    console.log('💾 Saving tokens to .env.local...')

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
    envContent += `\n# StockX OAuth Tokens (expires in 12 hours)\n`
    envContent += `STOCKX_ACCESS_TOKEN=${tokens.access_token}\n`
    if (tokens.refresh_token) {
      envContent += `STOCKX_REFRESH_TOKEN=${tokens.refresh_token}\n`
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n')

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 SUCCESS!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('✅ Access token saved to .env.local')
    if (tokens.refresh_token) {
      console.log('✅ Refresh token saved to .env.local')
    }
    console.log('\n📋 Token Info:')
    console.log(`   Type: ${tokens.token_type}`)
    if (tokens.expires_in) {
      const hours = Math.floor(tokens.expires_in / 3600)
      console.log(`   Expires in: ${hours} hours`)
    }
    console.log('\n🚀 Restart your dev server to load the new tokens:')
    console.log('   npm run dev\n')

    rl.close()

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    rl.close()
    process.exit(1)
  }
}

main()
