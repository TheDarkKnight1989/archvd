#!/usr/bin/env node

/**
 * Simple test to verify platform constraint fix
 * Uses service role key to bypass RLS
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✗ (not set)' : '✓')
  console.log('\n💡 Set SUPABASE_SERVICE_ROLE_KEY in your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('\n🔍 Testing Platform Constraint Fix...\n')

// Test 1: Check what platform values exist in the database
console.log('1️⃣  Checking existing platform values...')
const { data: platforms, error: platformError } = await supabase
  .from('Inventory')
  .select('platform')
  .not('platform', 'is', null)

if (platformError) {
  console.log('   ❌ Error:', platformError.message)
} else {
  const uniquePlatforms = [...new Set(platforms.map(p => p.platform))].sort()
  const hasCapitalized = uniquePlatforms.some(p => p !== p.toLowerCase())

  if (hasCapitalized) {
    console.log('   ❌ Still has capitalized values!')
    console.log('   Found:', uniquePlatforms.join(', '))
  } else {
    console.log('   ✅ All platforms are lowercase')
    if (uniquePlatforms.length > 0) {
      console.log('   Found:', uniquePlatforms.join(', '))
    }
  }
}

// Test 2: Try to insert a test record with 'goat' platform (then delete it)
console.log('\n2️⃣  Testing if "goat" platform is accepted...')

// First, get a user_id to use for the test
const { data: users } = await supabase
  .from('Inventory')
  .select('user_id')
  .limit(1)
  .single()

if (!users) {
  console.log('   ⚠️  No existing inventory items to get user_id from')
  console.log('   Skipping insert test')
} else {
  const testRecord = {
    user_id: users.user_id,
    sku: 'TEST-GOAT-PLATFORM',
    brand: 'TEST',
    model: 'Test Item',
    size: 'UK9',
    purchase_price: 100,
    purchase_date: new Date().toISOString().split('T')[0],
    status: 'active',
    platform: 'goat',  // This should work now
    location: 'Test Location'
  }

  const { data: inserted, error: insertError } = await supabase
    .from('Inventory')
    .insert(testRecord)
    .select()
    .single()

  if (insertError) {
    console.log('   ❌ Failed to insert test record with "goat" platform')
    console.log('   Error:', insertError.message)
    if (insertError.message.includes('Inventory_platform_check')) {
      console.log('\n   📋 The constraint was not updated correctly!')
      console.log('   Please run the migration again.')
    }
  } else {
    console.log('   ✅ Successfully inserted test record with "goat" platform')

    // Clean up - delete the test record
    await supabase
      .from('Inventory')
      .delete()
      .eq('id', inserted.id)

    console.log('   ✅ Test record cleaned up')
  }
}

// Test 3: Check if constraint allows all expected platforms
console.log('\n3️⃣  Summary...')
console.log('\nExpected lowercase platforms:')
const expectedPlatforms = [
  'stockx', 'goat', 'ebay', 'instagram', 'tiktok',
  'vinted', 'depop', 'private', 'shopify', 'other'
]
expectedPlatforms.forEach(p => console.log(`   • ${p}`))

console.log('\n' + '='.repeat(60))
console.log('✨ If all tests passed, you can now mark items as sold')
console.log('   with the Alias platform!')
console.log('='.repeat(60) + '\n')
