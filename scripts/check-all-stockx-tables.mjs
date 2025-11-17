import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllTables() {
  console.log('Checking all possible StockX credential locations...\n')

  // Check integrations
  const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', 'stockx')

  console.log('1. integrations table:')
  if (intError) {
    console.log('   Error:', intError.message)
  } else if (integrations && integrations.length > 0) {
    console.log('   ✅ Found:', integrations.length, 'record(s)')
    console.log('   First record:', {
      user_id: integrations[0].user_id,
      has_access_token: !!integrations[0].access_token,
      has_refresh_token: !!integrations[0].refresh_token,
    })
  } else {
    console.log('   ❌ No records found')
  }

  // Check stockx_oauth_credentials
  const { data: oauth, error: oauthError } = await supabase
    .from('stockx_oauth_credentials')
    .select('*')

  console.log('\n2. stockx_oauth_credentials table:')
  if (oauthError) {
    console.log('   Error:', oauthError.message)
  } else if (oauth && oauth.length > 0) {
    console.log('   ✅ Found:', oauth.length, 'record(s)')
    console.log('   First record:', {
      user_id: oauth[0].user_id,
      has_access_token: !!oauth[0].access_token,
      has_refresh_token: !!oauth[0].refresh_token,
    })
  } else {
    console.log('   ❌ No records found')
  }

  // Check user_settings or similar
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .limit(1)

  console.log('\n3. user_settings table:')
  if (settingsError) {
    console.log('   Error:', settingsError.message)
  } else if (settings && settings.length > 0) {
    console.log('   ✅ Table exists, has', settings.length, 'record(s)')
  } else {
    console.log('   ❌ No records found')
  }
}

checkAllTables().catch(console.error)
