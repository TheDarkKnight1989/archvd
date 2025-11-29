#!/usr/bin/env node
/**
 * Check RLS policies on stockx tables
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkRLS() {
  console.log('Checking RLS on stockx_market_latest...\n')

  const productId = '08a9310b-8a27-4222-8c21-864a18dcaf2c'
  const variantId = '5ff93930-73f7-4056-bbcb-11c5cbdd10c7'

  // Test with service role
  console.log('1. Query with SERVICE ROLE KEY (bypasses RLS):')
  const { data: serviceData, error: serviceError } = await serviceClient
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', productId)
    .eq('stockx_variant_id', variantId)

  console.log({
    found: serviceData?.length || 0,
    data: serviceData,
    error: serviceError,
  })

  // Test with anon key (no auth)
  console.log('\n2. Query with ANON KEY (no auth - subject to RLS):')
  const { data: anonData, error: anonError } = await anonClient
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', productId)
    .eq('stockx_variant_id', variantId)

  console.log({
    found: anonData?.length || 0,
    data: anonData,
    error: anonError,
  })

  // Check underlying table
  console.log('\n3. Query underlying stockx_market_snapshots with ANON KEY:')
  const { data: snapshotsData, error: snapshotsError } = await anonClient
    .from('stockx_market_snapshots')
    .select('*')
    .eq('stockx_product_id', productId)
    .eq('stockx_variant_id', variantId)
    .limit(1)

  console.log({
    found: snapshotsData?.length || 0,
    data: snapshotsData,
    error: snapshotsError,
  })

  // Test the exact query from market page
  console.log('\n4. Test EXACT market page query with ANON KEY:')
  const testProductId = '08a9310b-8a27-4222-8c21-864a18dcaf2c'
  const testVariantId = '5ff93930-73f7-4056-bbcb-11c5cbdd10c7'

  const { data: testData, error: testError } = await anonClient
    .from('stockx_market_latest')
    .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid, last_sale, snapshot_at')
    .eq('stockx_product_id', testProductId)
    .eq('stockx_variant_id', testVariantId)

  console.log({
    found: testData?.length || 0,
    data: testData,
    error: testError,
    fullError: testError ? {
      code: testError.code,
      message: testError.message,
      details: testError.details,
      hint: testError.hint,
    } : null,
  })
}

checkRLS().catch(console.error)
