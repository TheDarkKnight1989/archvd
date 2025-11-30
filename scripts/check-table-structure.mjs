#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('\n🔍 Checking inventory_market_links table structure...\n')

// Get one row to see the actual columns
const { data, error } = await supabase
  .from('inventory_market_links')
  .select('*')
  .limit(1)
  .single()

if (error) {
  console.error('❌ Error:', error)
} else {
  console.log('✅ Columns in the table:')
  console.log(Object.keys(data))
  console.log('\n✅ Sample row:')
  console.log(JSON.stringify(data, null, 2))
}

console.log('\n')
