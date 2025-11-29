#!/usr/bin/env node
/**
 * Simple script to add id column to product_catalog
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: 'public' }
})

async function addIdColumn() {
  console.log('🔧 Adding id column to product_catalog...\n')

  // Simple approach: just add the column with UNIQUE constraint
  const sql = `
    ALTER TABLE product_catalog
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE;
  `

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: sql
    })

    if (error) {
      console.log('❌ RPC method not available, showing SQL to run manually:\n')
      console.log('='.repeat(80))
      console.log(sql)
      console.log('='.repeat(80))
      console.log('\n📍 Run this SQL in Supabase Dashboard → SQL Editor\n')
      return
    }

    console.log('✅ Migration applied successfully!')
    console.log('Data:', data)

    // Verify
    const { data: sample, error: sampleError } = await supabase
      .from('product_catalog')
      .select('*')
      .limit(1)

    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0])
      console.log('\n✅ Verification:')
      console.log('Columns:', columns.join(', '))
      console.log('Has id column:', columns.includes('id') ? 'YES ✓' : 'NO ✗')
    }

  } catch (err) {
    console.error('❌ Error:', err.message)
    console.log('\n📍 Please run this SQL in Supabase Dashboard:\n')
    console.log('='.repeat(80))
    console.log(sql)
    console.log('='.repeat(80))
  }
}

addIdColumn()
