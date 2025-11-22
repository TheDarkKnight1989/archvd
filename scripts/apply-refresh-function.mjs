#!/usr/bin/env node
/**
 * Apply the refresh_stockx_market_latest() function migration
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function applyMigration() {
  console.log('📝 Applying refresh_stockx_market_latest() function migration...\n')

  // Read the migration file
  const sql = readFileSync('supabase/migrations/20251120_create_refresh_function.sql', 'utf8')

  console.log('SQL to execute:')
  console.log('-'.repeat(70))
  console.log(sql)
  console.log('-'.repeat(70))
  console.log()

  // Execute via direct pg connection (if available) or manual copy/paste needed
  console.log('⚠️  Please apply this migration manually:')
  console.log('1. Go to Supabase Dashboard → SQL Editor')
  console.log('2. Paste the SQL above')
  console.log('3. Run the query')
  console.log()
  console.log('OR copy/paste this into the SQL Editor:')
  console.log()
  console.log(sql)
}

applyMigration()
