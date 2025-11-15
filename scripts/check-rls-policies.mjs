/**
 * Check if RLS policies exist on stockx_market_prices
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔒 CHECKING RLS POLICIES\n')

// Check policies using service role
const { data: policies, error: policiesError } = await supabase
  .rpc('exec_sql', {
    sql: `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'stockx_market_prices';
    `
  })

if (policiesError) {
  console.log('   Checking policies via direct query instead...')

  // Try direct table access
  const { data: tableData, error: tableError } = await supabase
    .from('stockx_market_prices')
    .select('*')
    .limit(5)

  if (tableError) {
    console.error('❌ Table error:', tableError)
  } else {
    console.log(`✓ Direct table query returned ${tableData.length} rows`)
    tableData.forEach(row => {
      console.log(`  ${row.sku} size ${row.size}: $${row.lowest_ask}`)
    })
  }

  // Check view
  const { data: viewData, error: viewError } = await supabase
    .from('stockx_latest_prices')
    .select('*')
    .limit(5)

  if (viewError) {
    console.error('❌ View error:', viewError)
  } else {
    console.log(`\n✓ View query returned ${viewData.length} rows`)
    viewData.forEach(row => {
      console.log(`  ${row.sku} size ${row.size}: $${row.lowest_ask}`)
    })
  }
} else {
  console.log('✓ Found policies:')
  console.log(policies)
}
