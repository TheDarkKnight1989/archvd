#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Checking inventory_market_links provider column\n')
console.log('=' .repeat(80))

// Check all mappings and their provider value
const { data, error } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_product_id, stockx_variant_id, provider')
  .limit(20)

if (error) {
  console.error('\n❌ Error:', error.message)
  console.log('\nThis likely means the `provider` column does NOT exist!')
} else {
  console.log(`\n✅ Found ${data?.length ||0} mappings:\n`)
  data?.forEach((link, i) => {
    console.log(`${i + 1}. item_id: ${link.item_id.substring(0, 12)}...`)
    console.log(`   provider: ${link.provider || 'NULL'}`)
    console.log(`   stockx_product_id: ${link.stockx_product_id?.substring(0, 12) || 'NULL'}...`)
    console.log('')
  })
  
  const nullCount = data?.filter(d => !d.provider).length || 0
  const stockxCount = data?.filter(d => d.provider === 'stockx').length || 0
  
  console.log('Summary:')
  console.log(`  Total: ${data?.length || 0}`)
  console.log(`  provider = 'stockx': ${stockxCount}`)
  console.log(`  provider = NULL: ${nullCount}`)
  console.log('\n' + '='.repeat(80))
  
  if (nullCount > 0) {
    console.log('\n⚠️  PROBLEM FOUND: Some mappings have NULL provider!')
    console.log('The sync is filtering by provider="stockx" but these have NULL.')
  }
}
