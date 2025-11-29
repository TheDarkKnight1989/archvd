// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function applyMigration() {
  console.log('=== Applying Portfolio MV Refresh Migration ===\n')

  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      '/Users/ritesh/Projects/archvd/supabase/migrations/20251124_initial_refresh_portfolio_mv.sql',
      'utf8'
    )

    console.log('Applying migration...')

    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      return
    }

    console.log('✅ Migration applied successfully\n')

    // Verify the view now has data
    console.log('Verifying portfolio_value_daily...')
    const { data: checkData, error: checkError } = await supabase
      .from('portfolio_value_daily')
      .select('*')
      .limit(1)

    if (checkError) {
      console.error('❌ Error querying view:', checkError.message)
    } else if (checkData && checkData.length > 0) {
      console.log('✅ Portfolio view populated successfully')
      console.log('Columns:', Object.keys(checkData[0]))
      console.log('\nSample row:', JSON.stringify(checkData[0], null, 2))
    } else {
      console.log('⚠️  View is now accessible but contains no data (may be expected if no inventory exists)')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

applyMigration().catch(console.error)
