#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

const { data, error } = await supabase
  .from('stockx_accounts')
  .select('*')
  .eq('user_id', userId)

if (error) {
  console.log('❌ Database error:', error.message)
} else if (!data || data.length === 0) {
  console.log('❌ No StockX account connected')
} else {
  console.log('✅ StockX Account Found!')
  const account = data[0]
  console.log('  Access Token:', account.access_token ? 'Present' : 'Missing')
  console.log('  Refresh Token:', account.refresh_token ? 'Present' : 'Missing')
  console.log('  Email:', account.account_email || 'N/A')
  console.log('  Expires:', account.expires_at || 'Unknown')
}
