#!/usr/bin/env node
/**
 * Create the refresh_stockx_market_latest() function
 * This function is needed to refresh the materialized view
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function createRefreshFunction() {
  console.log('📝 Creating refresh_stockx_market_latest() function...\n')

  const sql = `
CREATE OR REPLACE FUNCTION refresh_stockx_market_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY stockx_market_latest;
END;
$$ LANGUAGE plpgsql;
`

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    console.error('❌ Error creating function:', error)

    // Try direct approach via PostgREST
    console.log('\n🔄 Trying alternative approach...\n')

    const { error: directError } = await supabase
      .from('_sqlquery')
      .insert({ query: sql })

    if (directError) {
      console.error('❌ Alternative approach failed:', directError)
      console.log('\n💡 You may need to run this SQL manually in Supabase SQL Editor:')
      console.log(sql)
      return false
    }
  }

  console.log('✅ Function created successfully!')
  console.log('\nNow you can refresh the view with:')
  console.log('  await supabase.rpc("refresh_stockx_market_latest")')

  return true
}

createRefreshFunction()
