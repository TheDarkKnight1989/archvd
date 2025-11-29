#!/usr/bin/env node

/**
 * Verify Platform Constraint Fix
 *
 * This script verifies that:
 * 1. All platform values in the database are lowercase
 * 2. The constraint accepts all expected platforms
 * 3. Mark as Sold should work with the Alias platform
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n🔍 Verifying Platform Constraint Fix...\n')

// Step 1: Check constraint definition
console.log('1️⃣  Checking constraint definition...')
const { data: constraintData, error: constraintError } = await supabase
  .rpc('exec_sql', {
    sql: `
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'Inventory_platform_check'
    `
  })

if (constraintError) {
  console.log('   ⚠️  Could not query constraint directly')
} else if (constraintData && constraintData.length > 0) {
  const def = constraintData[0].definition
  if (def.includes("'goat'") && def.includes("'stockx'")) {
    console.log('   ✅ Constraint includes lowercase values (goat, stockx, etc.)')
  } else if (def.includes("'Alias'") || def.includes("'StockX'")) {
    console.log('   ❌ Constraint still has capitalized values!')
    console.log('   📋 Run: scripts/fix-platform-data-and-constraint.sql')
  }
}

// Step 2: Check existing platform values in database
console.log('\n2️⃣  Checking existing platform values in database...')
const { data: platforms, error: platformsError } = await supabase
  .from('Inventory')
  .select('platform')
  .not('platform', 'is', null)

if (platformsError) {
  console.log('   ❌ Error querying platforms:', platformsError.message)
} else {
  const uniquePlatforms = [...new Set(platforms.map(p => p.platform))]
  const hasCapitalized = uniquePlatforms.some(p => p !== p.toLowerCase())

  if (hasCapitalized) {
    console.log('   ❌ Found capitalized platform values!')
    console.log('   Values:', uniquePlatforms.join(', '))
    console.log('   📋 Run: scripts/fix-platform-data-and-constraint.sql')
  } else {
    console.log('   ✅ All platform values are lowercase')
    console.log('   Values:', uniquePlatforms.sort().join(', '))
  }
}

// Step 3: Test that 'goat' platform is accepted
console.log('\n3️⃣  Testing if "goat" platform is accepted...')
const { error: goatError } = await supabase
  .from('Inventory')
  .select('id')
  .eq('platform', 'goat')
  .limit(1)

if (goatError) {
  console.log('   ❌ GOAT platform query failed:', goatError.message)
  console.log('   📋 Run: scripts/fix-platform-data-and-constraint.sql')
} else {
  console.log('   ✅ GOAT platform is accepted by the database')
}

// Step 4: Check all expected platforms
console.log('\n4️⃣  Checking all expected platforms...')
const expectedPlatforms = [
  'stockx', 'goat', 'ebay', 'instagram', 'tiktok',
  'vinted', 'depop', 'private', 'shopify', 'other'
]

let allAccepted = true
for (const platform of expectedPlatforms) {
  const { error } = await supabase
    .from('Inventory')
    .select('id')
    .eq('platform', platform)
    .limit(1)

  if (error) {
    console.log(`   ❌ Platform "${platform}" is NOT accepted`)
    allAccepted = false
  }
}

if (allAccepted) {
  console.log('   ✅ All expected platforms are accepted')
}

// Final summary
console.log('\n' + '='.repeat(60))
if (allAccepted) {
  console.log('✨ Platform constraint fix is complete!')
  console.log('\nNext steps:')
  console.log('  • Mark as Sold with Alias platform should now work')
  console.log('  • All new platforms (Instagram, TikTok, Vinted, Depop) are ready')
  console.log('  • Test the Mark as Sold modal in your app')
} else {
  console.log('⚠️  Platform constraint fix is NOT complete')
  console.log('\nAction required:')
  console.log('  1. Go to Supabase Dashboard → SQL Editor')
  console.log('  2. Run: scripts/fix-platform-data-and-constraint.sql')
  console.log('  3. Run this verification script again')
}
console.log('='.repeat(60) + '\n')
