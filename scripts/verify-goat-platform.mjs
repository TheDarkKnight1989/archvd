#!/usr/bin/env node

/**
 * Verify that 'goat' platform exists in database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n🔍 Checking sale_platform enum values...\n')

// Try to query a table that uses the sale_platform enum to see allowed values
const { data, error } = await supabase
  .from('Inventory')
  .select('platform')
  .limit(1)

if (error) {
  console.error('❌ Error querying database:', error.message)
  process.exit(1)
}

console.log('✅ Database connection successful\n')

// Try to create a test query with 'goat' platform
console.log('🧪 Testing if "goat" platform is accepted...\n')

const { error: testError } = await supabase
  .from('Inventory')
  .select('id')
  .eq('platform', 'goat')
  .limit(1)

if (testError) {
  console.error('❌ GOAT platform NOT FOUND in database!')
  console.error('\nError:', testError.message)
  console.error('\n📋 ACTION REQUIRED:')
  console.error('   1. Go to Supabase Dashboard → SQL Editor')
  console.error('   2. Run the migration: supabase/migrations/20251128_add_new_sale_platforms.sql')
  console.error('   3. This will add goat, instagram, tiktok, vinted, and depop platforms\n')
  process.exit(1)
} else {
  console.log('✅ GOAT platform exists in database!\n')
  console.log('The migration was successfully applied.')
  console.log('\nYou should now be able to mark items as sold with the Alias platform.\n')
}

// Also check if alias fee settings columns exist
console.log('🔍 Checking user_settings table for Alias fee columns...\n')

const { data: settings, error: settingsError } = await supabase
  .from('user_settings')
  .select('alias_region, alias_shipping_method, alias_commission_fee')
  .limit(1)
  .single()

if (settingsError && settingsError.code !== 'PGRST116') {
  console.log('⚠️  Alias fee settings columns might not exist')
  console.log('Error:', settingsError.message)
  console.log('\n📋 ACTION REQUIRED:')
  console.log('   1. Go to Supabase Dashboard → SQL Editor')
  console.log('   2. Run the migration: supabase/migrations/20251128_add_alias_fee_settings.sql\n')
} else {
  console.log('✅ Alias fee settings columns exist!\n')
  console.log('Configuration:')
  console.log('  - Region:', settings?.alias_region || 'uk (default)')
  console.log('  - Shipping Method:', settings?.alias_shipping_method || 'dropoff (default)')
  console.log('  - Commission Fee:', settings?.alias_commission_fee || '9.5% (default)')
  console.log()
}

console.log('✨ All checks complete!\n')
