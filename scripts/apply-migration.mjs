#!/usr/bin/env node
/**
 * Apply SQL migration to Supabase database
 * Run with: node scripts/apply-migration.mjs <migration-file>
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' }
})

async function applyMigration(filePath) {
  console.log(`📄 Reading migration: ${filePath}\n`)
  const sql = readFileSync(filePath, 'utf-8')

  console.log('📋 Migration SQL:')
  console.log('─'.repeat(80))
  console.log(sql)
  console.log('─'.repeat(80))
  console.log('\n⚠️  This script cannot execute raw SQL directly via Supabase JS client.')
  console.log('\n📝 To apply this migration:')
  console.log('   1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new')
  console.log('   2. Copy the SQL above')
  console.log('   3. Paste it into the SQL Editor')
  console.log('   4. Click "Run"\n')

  console.log('💡 Or apply via psql if you have database connection string:')
  console.log(`   psql "YOUR_CONNECTION_STRING" < ${filePath}\n`)
}

const migrationFile = process.argv[2] || 'supabase/migrations/20250108_fix_release_sources_columns.sql'
applyMigration(migrationFile).catch(console.error)
