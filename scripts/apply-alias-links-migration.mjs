#!/usr/bin/env node
/**
 * Apply inventory_alias_links migration
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyMigration() {
  console.log('Applying inventory_alias_links migration...\n')

  const sql = readFileSync('supabase/migrations/20251125_create_inventory_alias_links.sql', 'utf8')

  const { data, error } = await supabase.rpc('exec_sql', { sql })

  if (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  console.log('✅ Migration applied successfully!')
  console.log('\nCreated:')
  console.log('  - inventory_alias_links table')
  console.log('  - RLS policies')
  console.log('  - Indexes')
}

applyMigration()
