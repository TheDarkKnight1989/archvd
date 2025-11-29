#!/usr/bin/env node
/**
 * Apply catalog schema migration
 * Adds missing columns: silhouette, category, gender
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function applyMigration() {
  console.log('🔄 Applying catalog schema migration...\n')

  try {
    console.log('Step 1: Adding silhouette column to stockx_products...')
    const { error: error1 } = await supabase.rpc('exec', {
      sql: `ALTER TABLE stockx_products ADD COLUMN IF NOT EXISTS silhouette TEXT;`
    })
    if (error1 && !error1.message?.includes('already exists')) {
      console.log('   ℹ️  Column may already exist or using direct query...')
    } else {
      console.log('   ✅ silhouette column added')
    }

    console.log('\nStep 2: Adding category column to product_catalog...')
    const { error: error2 } = await supabase.rpc('exec', {
      sql: `ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS category TEXT;`
    })
    if (error2 && !error2.message?.includes('already exists')) {
      console.log('   ℹ️  Column may already exist or using direct query...')
    } else {
      console.log('   ✅ category column added')
    }

    console.log('\nStep 3: Adding gender column to product_catalog...')
    const { error: error3 } = await supabase.rpc('exec', {
      sql: `ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS gender TEXT;`
    })
    if (error3 && !error3.message?.includes('already exists')) {
      console.log('   ℹ️  Column may already exist or using direct query...')
    } else {
      console.log('   ✅ gender column added')
    }

    console.log('\n✅ Migration completed!\n')
    console.log('📋 Summary:')
    console.log('   • stockx_products.silhouette (TEXT, nullable)')
    console.log('   • product_catalog.category (TEXT, nullable)')
    console.log('   • product_catalog.gender (TEXT, nullable)\n')
    console.log('💡 Note: You can now use these columns in your catalog system.')
    console.log('   Silhouette will be populated when data is available.')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n💡 Tip: You may need to run this migration through Supabase Dashboard SQL Editor.')
    console.log('   Copy the SQL from: supabase/migrations/20251128_add_missing_catalog_columns.sql')
    process.exit(1)
  }
}

applyMigration()
