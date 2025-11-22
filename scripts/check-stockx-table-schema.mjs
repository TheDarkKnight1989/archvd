#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking stockx_accounts table structure...\n')

// Try to select all columns
const { data, error } = await supabase
  .from('stockx_accounts')
  .select('*')
  .limit(1)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log('❌ No data in table')
  process.exit(1)
}

const account = data[0]
console.log('✅ Table columns:')
console.log(Object.keys(account))
console.log('\n📊 Sample data:')
for (const [key, value] of Object.entries(account)) {
  if (key.includes('token') || key.includes('refresh')) {
    console.log(`  ${key}: ${value ? '[PRESENT]' : '[NULL]'}`)
  } else {
    console.log(`  ${key}: ${value}`)
  }
}
