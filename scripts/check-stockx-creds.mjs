import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCreds() {
  // Check integrations table
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', 'stockx')
    .maybeSingle()

  console.log('Integrations table:', integration ? 'Found' : 'Not found')
  if (integration) {
    console.log('  - User ID:', integration.user_id)
    console.log('  - Has access token:', !!integration.access_token)
  }

  // Check stockx_oauth_credentials table
  const { data: oauth } = await supabase
    .from('stockx_oauth_credentials')
    .select('*')
    .maybeSingle()

  console.log('\nstockx_oauth_credentials table:', oauth ? 'Found' : 'Not found')
  if (oauth) {
    console.log('  - User ID:', oauth.user_id)
    console.log('  - Has access token:', !!oauth.access_token)
  }
}

checkCreds().catch(console.error)
