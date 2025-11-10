#!/usr/bin/env node
/**
 * Apply FX Snapshots Accounting Migration
 * This script helps apply the 20251111 FX snapshots migration
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

async function applyMigration() {
  const migrationPath = 'supabase/migrations/20251111_fx_snapshots_accounting_per_user_base.sql'

  console.log('🚀 FX Snapshots Accounting Migration\n')
  console.log('📄 Reading migration file...')

  try {
    const sql = readFileSync(migrationPath, 'utf-8')

    console.log('✅ Migration file found\n')
    console.log('📊 Migration summary:')
    console.log('   • Extends profiles with base_currency column')
    console.log('   • Recreates fx_rates table with GBP pivot structure')
    console.log('   • Adds helper functions: fx_rate_for() and user_base_ccy()')
    console.log('   • Extends inventory table with purchase/sale FX columns')
    console.log('   • Extends expenses table with FX columns')
    console.log('   • Extends subscriptions table with FX columns')
    console.log('   • Implements idempotent backfill logic')
    console.log('   • Updates portfolio_latest_prices view')
    console.log('   • Creates fx_audit_log table\n')

    console.log('⚠️  To apply this migration, choose one of these methods:\n')

    console.log('METHOD 1: Supabase Dashboard SQL Editor (Recommended)')
    console.log('   1. Go to: https://supabase.com/dashboard/project/cjoucwhhwhpippksytoi/sql/new')
    console.log('   2. Copy the entire migration file content')
    console.log('   3. Paste it into the SQL Editor')
    console.log('   4. Click "Run" or press Cmd+Enter\n')

    console.log('METHOD 2: psql (If you have direct database access)')
    console.log(`   psql "postgresql://postgres:[password]@db.cjoucwhhwhpippksytoi.supabase.co:5432/postgres" < ${migrationPath}\n`)

    console.log('METHOD 3: Supabase CLI')
    console.log('   supabase db push\n')

    console.log('💡 The migration is idempotent and can be safely re-run.\n')

    // Try to verify current database state
    console.log('🔍 Checking current database state...\n')

    try {
      // Check if base_currency column exists in profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)

      if (profilesError) {
        console.log('⚠️  Could not check profiles table:', profilesError.message)
      } else if (profiles && profiles[0] && 'base_currency' in profiles[0]) {
        console.log('✅ Migration appears to be already applied (base_currency column exists)')
        return
      } else {
        console.log('📌 Migration needs to be applied (base_currency column not found)')
      }
    } catch (error) {
      console.log('⚠️  Could not verify database state:', error.message)
    }

    console.log('\n📋 Full migration SQL:')
    console.log('─'.repeat(80))
    console.log(sql)
    console.log('─'.repeat(80))

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message)
    process.exit(1)
  }
}

applyMigration().catch(console.error)
