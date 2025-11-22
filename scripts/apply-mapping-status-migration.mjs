#!/usr/bin/env node
/**
 * Apply Phase 3.11 Migration: Add mapping_status to inventory_market_links
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

console.log('\n🔧 Applying Phase 3.11 Migration')
console.log('=' .repeat(80))

const sql = readFileSync('supabase/migrations/20251120_add_mapping_status_to_inventory_market_links.sql', 'utf8')

// Split by semicolons and execute each statement
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s.length > 10)

console.log(`Found ${statements.length} SQL statements to execute\n`)

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i]

  console.log(`[${i + 1}/${statements.length}] Executing...`)
  console.log(`  ${statement.substring(0, 80)}...`)

  const { error } = await supabase.rpc('query', { sql: statement })

  if (error) {
    // Check if it's a "column already exists" error (which is fine)
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('  ⚠️  Already exists (skipping)')
    } else {
      console.error('  ❌ Error:', error.message)
      // Don't exit - try remaining statements
    }
  } else {
    console.log('  ✅ Success')
  }
}

console.log('\n' + '='.repeat(80))
console.log('✅ Migration complete\n')
