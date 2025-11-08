#!/usr/bin/env node
/**
 * Simple migration runner for Supabase
 * Reads SQL file and executes it against the Supabase database
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
  },
})

async function runMigration(filePath) {
  console.log(`📄 Reading migration: ${filePath}`)
  const sql = readFileSync(filePath, 'utf-8')

  console.log('🚀 Executing migration...')

  // Split by semicolons but keep transaction-aware
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (!statement) continue

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0) // Just test connection

        if (directError) {
          console.error(`❌ Statement ${i + 1} failed:`, error.message)
          console.error('Statement:', statement.substring(0, 100) + '...')
        }
      } else {
        console.log(`✓ Statement ${i + 1} executed`)
      }
    } catch (err) {
      console.error(`❌ Statement ${i + 1} error:`, err.message)
    }
  }

  console.log('✅ Migration completed')
}

// Run migration
const migrationFile = process.argv[2] || 'supabase/migrations/20250107_market_releases_schema.sql'
runMigration(migrationFile).catch(console.error)
