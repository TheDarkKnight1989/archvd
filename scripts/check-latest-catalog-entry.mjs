#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📋 Checking latest catalog entries...\n')

const { data, error } = await supabase
  .from('inventory_v4_style_catalog')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`✅ Found ${data.length} recent entries:\n`)

data.forEach((entry, i) => {
  console.log(`${i + 1}. ${entry.style_id}`)
  console.log(`   Brand: ${entry.brand || '(not set)'}`)
  console.log(`   Name: ${entry.name || '(not set)'}`)
  console.log(`   StockX URL: ${entry.stockx_url_key || '(not set)'}`)
  console.log(`   Alias ID: ${entry.alias_catalog_id || '(not set)'}`)
  console.log(`   Created: ${new Date(entry.created_at).toLocaleString()}`)
  console.log('')
})
