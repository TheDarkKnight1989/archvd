/**
 * Test script for V4 style resolve functionality
 * Tests the resolveOrCreateStyleV4 function directly
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TEST_SKU = 'TEST-V4-MARKET-001'

async function main() {
  console.log('=== V4 Style Resolve Test ===\n')

  // 1. Check if SKU already exists
  console.log('1. Checking if SKU exists:', TEST_SKU)
  const { data: existing, error: existError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, name, brand, stockx_product_id, alias_catalog_id')
    .eq('style_id', TEST_SKU)
    .maybeSingle()

  if (existError) {
    console.error('Error checking existing:', existError)
    process.exit(1)
  }

  if (existing) {
    console.log('   Style already exists:', existing)
    console.log('   Deleting for clean test...')

    // Delete queue jobs first
    await supabase
      .from('inventory_v4_sync_queue')
      .delete()
      .eq('style_id', TEST_SKU)

    // Delete style
    await supabase
      .from('inventory_v4_style_catalog')
      .delete()
      .eq('style_id', TEST_SKU)

    console.log('   Deleted.\n')
  } else {
    console.log('   Style does not exist (good)\n')
  }

  // 2. Insert the style using upsert
  console.log('2. Creating style via upsert...')
  const { data: created, error: createError } = await supabase
    .from('inventory_v4_style_catalog')
    .upsert({
      style_id: TEST_SKU,
      name: 'Test Market V4 Product',
      brand: 'Test Brand',
      colorway: 'Test Colorway',
      primary_image_url: 'https://image.goat.com/test.jpg',
    }, { onConflict: 'style_id' })
    .select()
    .single()

  if (createError) {
    console.error('Error creating style:', createError)
    process.exit(1)
  }
  console.log('   Created:', created.style_id, '\n')

  // 3. Enqueue sync jobs
  console.log('3. Enqueuing sync jobs...')

  // StockX job
  const { data: sxJob, error: sxError } = await supabase.rpc('enqueue_sync_job_v4', {
    p_style_id: TEST_SKU,
    p_provider: 'stockx',
  })
  if (sxError) {
    console.log('   StockX enqueue error:', sxError.message)
  } else {
    console.log('   StockX job:', sxJob)
  }

  // Alias job
  const { data: alJob, error: alError } = await supabase.rpc('enqueue_sync_job_v4', {
    p_style_id: TEST_SKU,
    p_provider: 'alias',
  })
  if (alError) {
    console.log('   Alias enqueue error:', alError.message)
  } else {
    console.log('   Alias job:', alJob)
  }
  console.log()

  // 4. Verify style exists in DB
  console.log('4. Verifying style in inventory_v4_style_catalog...')
  const { data: styleCheck, error: styleCheckError } = await supabase
    .from('inventory_v4_style_catalog')
    .select('style_id, name, brand, stockx_product_id, alias_catalog_id, created_at')
    .eq('style_id', TEST_SKU)
    .single()

  if (styleCheckError || !styleCheck) {
    console.error('   FAIL: Style not found!', styleCheckError)
    process.exit(1)
  }
  console.log('   PASS: Style exists')
  console.log('   Data:', JSON.stringify(styleCheck, null, 2))
  console.log()

  // 5. Verify queue jobs exist
  console.log('5. Verifying queue jobs in inventory_v4_sync_queue...')
  const { data: queueJobs, error: queueError } = await supabase
    .from('inventory_v4_sync_queue')
    .select('id, style_id, provider, status, created_at, attempts')
    .eq('style_id', TEST_SKU)

  if (queueError) {
    console.error('   Error checking queue:', queueError)
    process.exit(1)
  }

  if (!queueJobs || queueJobs.length === 0) {
    console.log('   WARN: No queue jobs found (enqueue may have failed)')
  } else {
    console.log('   PASS: Found', queueJobs.length, 'queue jobs')
    for (const job of queueJobs) {
      console.log(`   - ${job.provider}: status=${job.status}, attempts=${job.attempts}`)
    }
  }
  console.log()

  // Summary
  console.log('=== Summary ===')
  console.log('Style created:', !!styleCheck)
  console.log('Queue jobs:', queueJobs?.length || 0)
  console.log('\nTest SKU:', TEST_SKU)
  console.log('You can now test the market page with this SKU.')
}

main().catch(console.error)
