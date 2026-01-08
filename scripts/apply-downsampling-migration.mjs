#!/usr/bin/env node
/**
 * Apply Data Retention/Downsampling Migration
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('📦 Applying downsampling migration...\n')

  // Read migration file
  const migration = fs.readFileSync(
    'supabase/migrations/20251207_add_data_retention_policy.sql',
    'utf-8'
  )

  // Split into individual statements (basic split on semicolons)
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements\n`)

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip comments and empty statements
    if (!statement || statement.startsWith('--') || statement.startsWith('COMMENT ON')) {
      continue
    }

    console.log(`Executing statement ${i + 1}/${statements.length}...`)

    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

    if (error) {
      // Try direct execution for CREATE TABLE and CREATE FUNCTION
      console.log('  (trying direct execution)')

      // For now, just log - Supabase client doesn't support raw SQL execution
      // You'll need to run this manually in Supabase SQL editor
      console.log(`⚠️  Manual execution required for: ${statement.substring(0, 50)}...`)
    } else {
      console.log('  ✅ Success')
    }
  }

  console.log('\n✅ Migration statements prepared')
  console.log('\n⚠️  Note: Run the full migration in Supabase SQL editor:')
  console.log('  1. Go to Supabase Dashboard → SQL Editor')
  console.log('  2. Copy supabase/migrations/20251207_add_data_retention_policy.sql')
  console.log('  3. Execute the full file')
}

main().catch(console.error)
