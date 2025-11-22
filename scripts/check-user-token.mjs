import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const { data, error } = await supabase
  .from('stockx_accounts')
  .select('user_id, access_token, refresh_token, expires_at')
  .order('updated_at', { ascending: false })
  .limit(1)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log('No StockX accounts found')
  process.exit(1)
}

const account = data[0]
console.log('User ID:', account.user_id)
const expiresAt = new Date(account.expires_at)
const now = new Date()
const isExpired = expiresAt <= now
console.log('Is expired:', isExpired)
console.log('Expires at:', account.expires_at)
if (!isExpired) {
  console.log('Minutes remaining:', Math.round((expiresAt - now) / 1000 / 60))
}
