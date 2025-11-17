/**
 * StockX OAuth Token Diagnostic Script
 * Checks token status and attempts refresh if needed
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTokenStatus() {
  console.log('🔍 Checking StockX OAuth token status...\n')

  // Get current auth data
  const { data: account, error } = await supabase
    .from('stockx_accounts')
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('❌ Database error:', error.message)
    return null
  }

  if (!account) {
    console.log('❌ No StockX account found. Please connect StockX in Settings → Integrations.')
    return null
  }

  console.log('✅ StockX account found')
  console.log('   User ID:', account.user_id)
  console.log('   Created:', new Date(account.created_at).toLocaleString())
  console.log('   Updated:', new Date(account.updated_at).toLocaleString())

  // Check token expiry
  if (account.expires_at) {
    const expiresAt = new Date(account.expires_at)
    const now = new Date()
    const minutesUntilExpiry = (expiresAt - now) / 1000 / 60

    console.log('   Expires:', expiresAt.toLocaleString())

    if (minutesUntilExpiry <= 0) {
      console.log('   ⚠️  Token EXPIRED', Math.abs(minutesUntilExpiry).toFixed(0), 'minutes ago')
    } else if (minutesUntilExpiry < 60) {
      console.log('   ⚠️  Token expires soon:', minutesUntilExpiry.toFixed(0), 'minutes')
    } else {
      console.log('   ✅ Token valid for:', (minutesUntilExpiry / 60).toFixed(1), 'hours')
    }
  }

  return account
}

async function testAccessToken(accessToken) {
  console.log('\n🧪 Testing access token with StockX API...')

  try {
    const response = await fetch('https://api.stockx.com/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('   Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      console.log('   ✅ Token is valid!')
      console.log('   User:', data.email || data.id)
      return true
    } else {
      const errorText = await response.text()
      console.log('   ❌ Token is invalid or expired')
      console.log('   Error:', errorText)
      return false
    }
  } catch (error) {
    console.error('   ❌ Network error:', error.message)
    return false
  }
}

async function refreshToken(refreshToken) {
  console.log('\n🔄 Attempting to refresh token...')

  try {
    const response = await fetch('https://accounts.stockx.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.STOCKX_CLIENT_ID,
        client_secret: process.env.STOCKX_CLIENT_SECRET,
      }),
    })

    console.log('   Status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('   ❌ Refresh failed:', errorText)
      return null
    }

    const tokens = await response.json()
    console.log('   ✅ Token refresh successful!')

    // Update database with new tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    const { error: updateError } = await supabase
      .from('stockx_accounts')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken, // Use new if provided
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('refresh_token', refreshToken)

    if (updateError) {
      console.error('   ❌ Failed to save new tokens:', updateError.message)
      return null
    }

    console.log('   ✅ New tokens saved to database')
    console.log('   New expiry:', expiresAt.toLocaleString())

    return tokens.access_token
  } catch (error) {
    console.error('   ❌ Error:', error.message)
    return null
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('StockX OAuth Token Diagnostics')
  console.log('='.repeat(60))

  // Check current token status
  const account = await checkTokenStatus()

  if (!account) {
    process.exit(1)
  }

  // Test if access token works
  const isValid = await testAccessToken(account.access_token)

  if (isValid) {
    console.log('\n✅ Everything is working correctly!')
    process.exit(0)
  }

  // Token is invalid, try to refresh
  if (!account.refresh_token) {
    console.log('\n❌ No refresh token available. Please reconnect StockX in Settings → Integrations.')
    process.exit(1)
  }

  const newAccessToken = await refreshToken(account.refresh_token)

  if (!newAccessToken) {
    console.log('\n❌ Token refresh failed. Please reconnect StockX in Settings → Integrations.')
    console.log('\nSteps to reconnect:')
    console.log('1. Go to Settings → Integrations')
    console.log('2. Disconnect StockX')
    console.log('3. Connect StockX again')
    process.exit(1)
  }

  // Test new token
  const newTokenValid = await testAccessToken(newAccessToken)

  if (newTokenValid) {
    console.log('\n✅ Token successfully refreshed! You can now use StockX features.')
  } else {
    console.log('\n❌ New token still invalid. Please reconnect StockX manually.')
  }
}

main().catch(console.error)
