#!/usr/bin/env node
/**
 * Verify StockX OAuth Connection
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verify() {
  console.log('🔍 Verifying StockX Connection...')
  console.log()

  // Check OAuth token
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id || 'fbcde760-820b-4eaf-949f-534a8130d44b'

  const { data: oauth, error: oauthError } = await supabase
    .from('stockx_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (oauthError || !oauth) {
    console.log('❌ StockX NOT Connected')
    console.log()
    console.log('Please connect via:')
    console.log('  http://localhost:3000/portfolio/settings/integrations')
    console.log()
    return
  }

  console.log('✅ StockX Connected!')
  console.log()
  console.log('OAuth Details:')
  console.log(`  User ID: ${oauth.user_id}`)
  console.log(`  Access Token: ${oauth.access_token ? 'Present ✓' : 'Missing ✗'}`)
  console.log(`  Refresh Token: ${oauth.refresh_token ? 'Present ✓' : 'Missing ✗'}`)
  console.log(`  Token Type: ${oauth.token_type || 'Unknown'}`)
  console.log(`  Expires At: ${oauth.expires_at ? new Date(oauth.expires_at).toLocaleString() : 'Unknown'}`)
  console.log()

  // Check if token is expired
  if (oauth.expires_at) {
    const expiresAt = new Date(oauth.expires_at)
    const now = new Date()
    const isExpired = expiresAt < now

    if (isExpired) {
      console.log('⚠️  Token is expired!')
      console.log('   The worker will automatically refresh it on next use.')
    } else {
      const hoursLeft = Math.round((expiresAt - now) / 1000 / 60 / 60)
      console.log(`✓ Token valid for ${hoursLeft} more hours`)
    }
    console.log()
  }

  // Check if jobs can now be processed
  const { data: pendingJobs, count } = await supabase
    .from('market_jobs')
    .select('*', { count: 'exact' })
    .eq('status', 'pending')
    .eq('user_id', userId)

  console.log(`📋 Pending Jobs: ${count || 0}`)
  if (count && count > 0) {
    console.log()
    console.log('✅ Ready to process! Trigger the scheduler:')
    console.log('   curl -X POST http://localhost:3000/api/market/scheduler/run \\')
    console.log(`     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`)
  }
  console.log()
}

verify()
