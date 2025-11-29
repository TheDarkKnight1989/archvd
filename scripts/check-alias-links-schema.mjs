#!/usr/bin/env node
/**
 * Check inventory_alias_links table schema
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  console.log('🔍 Checking inventory_alias_links schema...\n')

  // Check if table exists
  const { data: tables, error: tableError } = await supabase
    .from('inventory_alias_links')
    .select('*')
    .limit(0)

  if (tableError) {
    console.error('❌ Table does not exist or cannot be accessed:', tableError.message)
    return
  }

  console.log('✅ Table exists')

  // Try a test query to see what columns are available
  const { data, error } = await supabase
    .from('inventory_alias_links')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Error querying table:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('\n📋 Sample row columns:')
    console.log(Object.keys(data[0]))
  } else {
    console.log('\n📋 Table is empty, cannot show columns')
    console.log('💡 Attempting to insert a test row to see schema...')
  }

  // Check RLS policies
  console.log('\n🔒 Checking RLS policies...')
  const { data: policies } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'inventory_alias_links'
      ORDER BY policyname;
    `
  })

  if (policies) {
    console.log('✅ RLS Policies found:', policies.length)
  }
}

checkSchema().catch(console.error)
