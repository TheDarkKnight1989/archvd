import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_ITEM_ID = '3c386636-f732-401e-9d78-201f36a217f2'

async function checkProvider() {
  console.log('🔍 Checking provider column...\n')

  // Query WITHOUT provider filter (like my script)
  const { data: withoutFilter, error: err1 } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', TEST_ITEM_ID)
    .maybeSingle()

  console.log('WITHOUT provider filter:')
  console.log(JSON.stringify(withoutFilter, null, 2))
  console.log()

  // Query WITH provider filter (like the worker)
  const { data: withFilter, error: err2 } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', TEST_ITEM_ID)
    .eq('provider', 'stockx')
    .maybeSingle()

  console.log('WITH provider = "stockx" filter:')
  console.log(JSON.stringify(withFilter, null, 2))
  console.log()

  if (!withFilter && withoutFilter) {
    console.log('❌ BUG FOUND: The provider filter is causing the query to return NO results!')
    console.log('   The worker cannot find the mapping because of the provider filter.')
    console.log('\n   Provider value in DB:', withoutFilter.provider)
  }
}

checkProvider()
