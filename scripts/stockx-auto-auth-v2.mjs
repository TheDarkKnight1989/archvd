#!/usr/bin/env node
/**
 * StockX Automated OAuth Flow (Using LocalTunnel)
 *
 * This script automates the entire OAuth flow:
 * 1. Starts local callback server
 * 2. Starts localtunnel
 * 3. Opens authorize URL in browser
 * 4. Receives callback automatically
 * 5. Exchanges code for tokens
 * 6. Saves tokens to .env.local
 */

import 'dotenv/config'
import { exec } from 'child_process'
import { promisify } from 'util'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import localtunnel from 'localtunnel'
import readline from 'readline'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CLIENT_ID = process.env.STOCKX_CLIENT_ID
const CLIENT_SECRET = process.env.STOCKX_CLIENT_SECRET
const CALLBACK_PORT = 3001 // Different from main app (3000)

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing STOCKX_CLIENT_ID or STOCKX_CLIENT_SECRET in .env.local')
  process.exit(1)
}

console.log('\n🚀 StockX Automated OAuth Flow\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

let tunnel = null
let server = null
let tokensResolver = null

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n\n🧹 Cleaning up...')
  if (tunnel) await tunnel.close()
  if (server) server.close()
  process.exit(0)
})

async function main() {
  try {
    // Step 1: Start callback server
    console.log(`🖥️  Starting callback server on port ${CALLBACK_PORT}...`)

    const app = express()
    let callbackUrl = null

    // Create promise for tokens
    const tokensPromise = new Promise((resolve, reject) => {
      tokensResolver = { resolve, reject }
    })

    // Health check
    app.get('/', (req, res) => {
      res.send('StockX OAuth callback server is running. Waiting for authorization...')
    })

    // OAuth callback endpoint
    app.get('/api/stockx/oauth/callback', async (req, res) => {
      const { code, error } = req.query

      if (error) {
        console.error(`\n❌ OAuth error: ${error}`)
        res.status(400).send(`OAuth error: ${error}`)
        tokensResolver.reject(new Error(error))
        return
      }

      if (!code) {
        console.error('\n❌ No authorization code received')
        res.status(400).send('No authorization code received')
        tokensResolver.reject(new Error('No code'))
        return
      }

      console.log(`\n✅ Received authorization code: ${code.substring(0, 20)}...`)

      // Show loading page
      res.send(`
        <html>
          <head><title>StockX OAuth</title></head>
          <body style="font-family: sans-serif; max-width: 600px; margin: 100px auto; text-align: center;">
            <h1>✅ Authorization successful!</h1>
            <p>Exchanging code for tokens...</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `)

      // Exchange code for tokens
      try {
        console.log('🔄 Exchanging authorization code for access token...')

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
          throw new Error(`Token exchange failed (${tokenResponse.status}): ${errorText}`)
        }

        const tokens = await tokenResponse.json()

        console.log('✅ Successfully obtained tokens!')

        tokensResolver.resolve(tokens)
      } catch (err) {
        console.error(`\n❌ Token exchange error: ${err.message}`)
        tokensResolver.reject(err)
      }
    })

    server = app.listen(CALLBACK_PORT, () => {
      console.log(`✅ Callback server listening on http://localhost:${CALLBACK_PORT}\n`)
    })

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${CALLBACK_PORT} is already in use`)
        console.log('Please stop any other servers running on this port and try again')
      }
      tokensResolver.reject(err)
    })

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Step 2: Start tunnel
    console.log(`🌐 Starting tunnel on port ${CALLBACK_PORT}...`)

    tunnel = await localtunnel({ port: CALLBACK_PORT })
    callbackUrl = `${tunnel.url}/api/stockx/oauth/callback`

    console.log(`✅ Tunnel active: ${tunnel.url}\n`)

    tunnel.on('close', () => {
      console.log('Tunnel closed')
    })

    // Step 3: Build authorize URL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚠️  IMPORTANT: Make sure callback URL is set!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('Ensure your StockX app callback URL is set to:')
    console.log(`   ${callbackUrl}\n`)
    console.log('If not already set, update it at: https://developer.stockx.com')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Give user 5 seconds to verify
    console.log('⏳ Starting OAuth flow in 5 seconds...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))

    const state = Math.random().toString(36).substring(7)
    const authorizeUrl = new URL('https://accounts.stockx.com/authorize')
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', CLIENT_ID)
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl)
    authorizeUrl.searchParams.set('scope', 'offline_access openid')
    authorizeUrl.searchParams.set('audience', 'gateway.stockx.com')
    authorizeUrl.searchParams.set('state', state)

    // Step 4: Open authorize URL in browser
    console.log('\n🌐 Opening StockX login page...')
    console.log('\nYou will be redirected to StockX to log in.')
    console.log('After login, you\'ll be redirected back automatically.\n')

    openBrowser(authorizeUrl.toString())

    // Step 5: Wait for tokens
    console.log('⏳ Waiting for authorization...')
    console.log('   (Complete the login in your browser)\n')

    const tokens = await tokensPromise

    // Step 6: Save tokens
    saveTokensToEnv(tokens)

    // Success!
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 SUCCESS! StockX OAuth Complete!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('✅ Access token saved to .env.local')
    console.log('✅ Refresh token saved to .env.local')
    console.log('\n🚀 You can now use the StockX API!')
    console.log('\n   Restart your dev server to load the new tokens:')
    console.log('   npm run dev\n')

    // Cleanup
    if (tunnel) {
      await tunnel.close()
      console.log('🧹 Cleaned up tunnel')
    }
    if (server) {
      server.close()
      console.log('🧹 Stopped callback server\n')
    }

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Error:', error.message)

    // Cleanup
    if (tunnel) await tunnel.close()
    if (server) server.close()

    process.exit(1)
  }
}

function openBrowser(url) {
  const platform = process.platform
  let command

  if (platform === 'darwin') command = 'open'
  else if (platform === 'win32') command = 'start'
  else command = 'xdg-open'

  exec(`${command} "${url}"`, (err) => {
    if (err) {
      console.error('❌ Could not open browser automatically')
      console.log(`\nPlease open this URL manually:\n${url}\n`)
    } else {
      console.log('✅ Opened authorize URL in browser')
    }
  })
}

function saveTokensToEnv(tokens) {
  const envPath = path.join(__dirname, '..', '.env.local')

  console.log('\n💾 Saving tokens to .env.local...')

  let envContent = ''

  // Read existing .env.local
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')

    // Remove existing STOCKX_ACCESS_TOKEN and STOCKX_REFRESH_TOKEN
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('STOCKX_ACCESS_TOKEN=') && !line.startsWith('STOCKX_REFRESH_TOKEN='))
      .join('\n')
  }

  // Add new tokens
  envContent += `\n# StockX OAuth Tokens (expires in 12 hours)\n`
  envContent += `STOCKX_ACCESS_TOKEN=${tokens.access_token}\n`
  envContent += `STOCKX_REFRESH_TOKEN=${tokens.refresh_token}\n`

  fs.writeFileSync(envPath, envContent.trim() + '\n')

  console.log('✅ Tokens saved to .env.local')

  if (tokens.expires_in) {
    const hours = Math.floor(tokens.expires_in / 3600)
    console.log(`\n⏰ Access token expires in ${hours} hours`)
    console.log('   Use the refresh token to get a new one when it expires')
  }
}

main()
