#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking stockx_accounts table...\n')

const { data, error } = await supabase
  .from('stockx_accounts')
  .select('user_id, expires_at, created_at, updated_at')
  .order('created_at', { ascending: false })
  .limit(5)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log('❌ No StockX accounts found in database')
  console.log('💡 A user needs to complete OAuth flow first')
  process.exit(1)
}

console.log(`✅ Found ${data.length} StockX account(s):\n`)

for (const account of data) {
  const expiresAt = new Date(account.expires_at)
  const now = new Date()
  const isExpired = expiresAt < now
  const timeUntilExpiry = Math.round((expiresAt - now) / 1000 / 60) // minutes

  console.log(`User ID: ${account.user_id}`)
  console.log(`Expires: ${account.expires_at}`)
  console.log(`  ${isExpired ? '❌ EXPIRED' : `✅ Valid for ${timeUntilExpiry} minutes`}`)
  console.log(`Created: ${account.created_at}`)
  console.log(`Updated: ${account.updated_at}`)
  console.log('')
}

// Get the most recent account
const activeAccount = data[0]
console.log(`💡 Will use account: ${activeAccount.user_id}`)
const expiresAt = new Date(activeAccount.expires_at)
const now = new Date()
const isExpired = expiresAt < now
console.log(`   ${isExpired ? '❌ Token expired' : '✅ Token valid'}`)
