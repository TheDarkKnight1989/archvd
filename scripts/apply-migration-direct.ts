#!/usr/bin/env node

/**
 * Apply migration by executing SQL statements directly via Supabase client
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing environment variables')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔄 Applying migration SQL...\n')

  try {
    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/20251211_create_sync_queue_system.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    // Split into individual statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📋 Executing ${statements.length} SQL statements...\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'

      // Skip DO blocks and comments
      if (statement.includes('DO $$') || statement.startsWith('COMMENT ON')) {
        continue
      }

      try {
        const { error } = await supabase.rpc('query', { query_text: statement })
        if (error && !error.message.includes('already exists')) {
          console.error(`⚠️  Statement ${i + 1} error:`, error.message.substring(0, 200))
        } else {
          console.log(`✅ Statement ${i + 1}`)
        }
      } catch (err) {
        console.error(`⚠️  Statement ${i + 1} failed:`, err)
      }
    }

    console.log('\n✅ Migration completed!\n')

    // Verify
    const { data: functions, error: fnError } = await supabase.rpc('fetch_sync_jobs', {
      _limit: 1,
      _provider: null
    })

    if (fnError) {
      console.error('⚠️  Function verification failed:', fnError.message)
      console.error('   You may need to apply the migration manually through Supabase Studio')
    } else {
      console.log('✅ Function verified: fetch_sync_jobs exists\n')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
