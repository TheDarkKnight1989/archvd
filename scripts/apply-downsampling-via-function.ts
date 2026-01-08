#!/usr/bin/env npx tsx
/**
 * Apply downsampling migration via Supabase RPC
 * Creates a temporary function to execute DDL, then drops it
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('📦 Applying downsampling migration via RPC...\n')

  // Read migration file
  const migrationSQL = readFileSync(
    'supabase/migrations/20251207_add_data_retention_policy.sql',
    'utf-8'
  )

  // Escape the SQL for embedding in a function
  const escapedSQL = migrationSQL.replace(/\$/g, '\\$').replace(/'/g, "''")

  // Create a temporary migration function
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION temp_apply_downsampling_migration()
RETURNS TEXT AS $$
BEGIN
  EXECUTE '${escapedSQL}';
  RETURN 'Migration applied successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `.trim()

  console.log('Creating temporary migration function...')

  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: createFunctionSQL
  })

  if (createError) {
    console.error('❌ Failed to create migration function:', createError.message)
    console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor:')
    console.log('  1. Open: https://supabase.com/dashboard/project/cjoucwhhwhpippksytoi/sql/new')
    console.log('  2. Copy supabase/migrations/20251207_add_data_retention_policy.sql')
    console.log('  3. Paste and execute')
    return
  }

  console.log('  ✅ Function created\n')

  // Execute the migration
  console.log('Executing migration...')

  const { data, error: execError } = await supabase.rpc('temp_apply_downsampling_migration')

  if (execError) {
    console.error('❌ Migration failed:', execError.message)
    return
  }

  console.log('  ✅', data)

  // Drop the temporary function
  console.log('\nCleaning up...')

  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: 'DROP FUNCTION IF EXISTS temp_apply_downsampling_migration();'
  })

  if (dropError) {
    console.warn('⚠️  Could not drop temporary function (non-critical)')
  } else {
    console.log('  ✅ Temporary function dropped')
  }

  console.log('\n✅ Downsampling migration applied successfully!\n')
  console.log('Created:')
  console.log('  - master_market_data_daily table')
  console.log('  - master_market_data_weekly table')
  console.log('  - downsample_to_daily() function')
  console.log('  - downsample_to_weekly() function')
  console.log('')
}

main().catch(console.error)
