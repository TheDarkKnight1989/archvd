#!/usr/bin/env node
/**
 * Check product_catalog primary key structure
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
  auth: { persistSession: false }
})

async function checkPrimaryKey() {
  console.log('🔍 Checking product_catalog primary key...\n')

  // Try to get table info using PostgreSQL system tables
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        a.attname as column_name,
        format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null,
        COALESCE(i.indisprimary, false) as is_primary_key
      FROM pg_attribute a
      LEFT JOIN pg_index i ON (a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND i.indisprimary)
      WHERE a.attrelid = 'product_catalog'::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum;
    `
  })

  if (error) {
    console.log('❌ Direct query failed, trying alternative method...')
    console.log('Error:', error.message)

    // Try a simpler query
    const { data: sampleData, error: sampleError } = await supabase
      .from('product_catalog')
      .select('*')
      .limit(1)

    if (sampleError) {
      console.log('❌ Cannot query product_catalog:', sampleError.message)
      return
    }

    console.log('✅ Table accessible')
    console.log('📋 Columns found:', Object.keys(sampleData[0] || {}).join(', '))
    console.log('\n⚠️  Cannot determine primary key - need to check in Supabase Dashboard')
    return
  }

  console.log('✅ Table structure:')
  console.log(JSON.stringify(data, null, 2))
}

checkPrimaryKey()
