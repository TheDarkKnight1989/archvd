#!/usr/bin/env node
/**
 * Apply product_catalog id column migration
 * This fixes the critical missing id column issue
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('🔧 Applying product_catalog id column migration...\n')
console.log('📋 This migration will:')
console.log('   1. Add id UUID column with auto-generation')
console.log('   2. Set id as the primary key')
console.log('   3. Keep sku as unique constraint')
console.log('   4. Preserve all existing data\n')

console.log('⚠️  IMPORTANT: This migration requires direct SQL access.')
console.log('   Please run this SQL in your Supabase Dashboard SQL Editor:\n')

const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251128_fix_product_catalog_id.sql')
const migrationSql = readFileSync(migrationPath, 'utf-8')

console.log('='.repeat(80))
console.log('MIGRATION SQL:')
console.log('='.repeat(80))
console.log(migrationSql)
console.log('='.repeat(80))

console.log('\n📍 Steps to apply:')
console.log('   1. Go to Supabase Dashboard → SQL Editor')
console.log('   2. Create a new query')
console.log('   3. Copy and paste the SQL above')
console.log('   4. Click "Run" to execute')
console.log('   5. Check the output for success messages\n')

console.log('💡 Or copy this file directly:')
console.log(`   ${migrationPath}\n`)

// Try to detect if we can run it programmatically
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

console.log('🔄 Attempting to check if migration is needed...')

const { data: sampleData, error: sampleError } = await supabase
  .from('product_catalog')
  .select('*')
  .limit(1)

if (sampleError) {
  console.log('❌ Cannot access product_catalog:', sampleError.message)
  process.exit(1)
}

const columns = sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : []
const hasId = columns.includes('id')

if (hasId) {
  console.log('✅ id column already exists in product_catalog!')
  console.log('   Migration may have already been applied.')
  console.log('   Current columns:', columns.join(', '))
} else {
  console.log('❌ id column is MISSING from product_catalog')
  console.log('   Current columns:', columns.join(', '))
  console.log('\n🚨 MIGRATION REQUIRED - Please run the SQL above in Supabase Dashboard')
}

console.log('\n' + '='.repeat(80))
console.log('After applying the migration, run the diagnostic again:')
console.log('   node scripts/diagnose-catalog-schema.mjs')
console.log('='.repeat(80))
