// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function checkSchema() {
  console.log('=== Checking portfolio_value_daily schema ===\n')

  // Query the view to see what columns exist
  const { data, error } = await supabase
    .from('portfolio_value_daily')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Error querying view:', error.message)
    console.error('Details:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Found columns:', Object.keys(data[0]))
    console.log('\nSample row:', JSON.stringify(data[0], null, 2))
  } else {
    console.log('⚠️  View exists but is empty')
  }
}

checkSchema().catch(console.error)
