#!/usr/bin/env node
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

console.log('🚀 Alias Catalog Items Table Migration\n')

// First check if table exists
console.log('🔍 Checking if table already exists...\n')

const { data, error } = await supabase
  .from('alias_catalog_items')
  .select('id')
  .limit(1)

if (!error) {
  console.log('✅ Table alias_catalog_items already exists!')
  console.log('   Nothing to do. Images should be working.')
  process.exit(0)
}

if (error && error.code !== 'PGRST205') {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
}

console.log('⚠️  Table does not exist. Please create it.\n')

const migrationPath = 'supabase/migrations/20251125_alias_catalog_items.sql'
const sql = readFileSync(migrationPath, 'utf-8')

console.log('📋 METHOD 1: Supabase Dashboard SQL Editor (RECOMMENDED)')
console.log('   1. Go to: https://supabase.com/dashboard/project/cjoucwhhwhpippksytoi/sql/new')
console.log('   2. Copy the SQL below')
console.log('   3. Paste it into the SQL Editor')
console.log('   4. Click "Run" or press Cmd+Enter\n')

console.log('═'.repeat(80))
console.log(sql)
console.log('═'.repeat(80))

console.log('\n💡 After running the SQL:')
console.log('   1. Uncomment lines 143-149 in src/hooks/useInventoryV3.ts')
console.log('   2. Refresh the inventory page')
console.log('   3. Alias images will now load!')
