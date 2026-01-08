#!/usr/bin/env node

/**
 * Check the current definition of idx_master_market_unique_snapshot
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════')
  console.log('INDEX DEFINITION CHECK')
  console.log('═══════════════════════════════════════════════════════════════════════════\n')

  // Try to get index definition via SQL query through an API route
  // Since we can't use rpc, let's use a workaround

  try {
    // Try inserting a duplicate to see what constraint fails
    const testRow = {
      provider: 'alias',
      provider_source: 'catalog',
      provider_product_id: 'test_check_index',
      size_key: 'US_M_10',
      currency_code: 'USD',
      region_code: 'global',
      snapshot_at: new Date().toISOString(),
    }

    console.log('Testing with a sample row to check index structure...\n')

    // First insert
    const { error: insert1Error } = await supabase
      .from('master_market_data')
      .insert(testRow)

    if (insert1Error) {
      console.error('❌ First insert failed:', insert1Error.message)
      console.log('\nThis indicates the table might have issues.\n')
      return
    }

    console.log('✅ First insert successful\n')

    // Second insert (should fail with unique constraint)
    const { error: insert2Error } = await supabase
      .from('master_market_data')
      .insert(testRow)

    if (insert2Error) {
      console.log('✅ Second insert failed as expected (unique constraint)\n')
      console.log('Error details:')
      console.log('  Code:', insert2Error.code)
      console.log('  Message:', insert2Error.message)
      console.log('  Details:', insert2Error.details)
      console.log()

      // Check if error mentions is_flex or is_consigned in the details
      const errorDetails = insert2Error.details || ''
      const hasFlexInError = errorDetails.includes('is_flex')
      const hasConsignedInError = errorDetails.includes('is_consigned')

      if (hasFlexInError && hasConsignedInError) {
        console.log('✅ Index INCLUDES flex/consigned columns')
        console.log('   Your schema is up to date!')
      } else {
        console.log('⚠️  Index DOES NOT include flex/consigned columns')
        console.log('   You need to apply: 20251203_add_flex_consigned_support.sql')
      }
      console.log()
    } else {
      console.log('⚠️  Second insert succeeded (no unique constraint enforced!)')
      console.log('   This suggests the unique index is missing.\n')
    }

    // Cleanup
    console.log('Cleaning up test data...')
    await supabase
      .from('master_market_data')
      .delete()
      .eq('provider_product_id', 'test_check_index')

    console.log('✅ Cleanup complete\n')
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error)
