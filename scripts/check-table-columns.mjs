#!/usr/bin/env node
/**
 * Check actual column names in inventory_market_links table
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🔍 Checking inventory_market_links table schema...\n')

// Query to get table columns
const { data, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .limit(1)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (data && data.length > 0) {
  console.log('✅ Sample row found')
  console.log('\n📋 Column names in inventory_market_links:')
  console.log(Object.keys(data[0]).map(k => `  - ${k}`).join('\n'))
  console.log('\n📦 Sample data:')
  console.log(JSON.stringify(data[0], null, 2))
} else {
  console.log('⚠️  No data in table (table might be empty)')

  // Try to get column info from the schema
  console.log('\nAttempting to describe table structure...')
}

console.log('\n✨ Done')
