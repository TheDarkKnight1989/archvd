#!/usr/bin/env tsx

/**
 * Test inserting into fx_rates using raw SQL
 */

import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  console.log('Testing FX rates insert via raw SQL...\n')

  // Method 1: Using Supabase client .insert() (we know this fails)
  console.log('Method 1: Supabase client .insert()')
  const { data: data1, error: error1 } = await supabase
    .from('fx_rates')
    .insert({
      as_of: '2025-01-02',
      gbp_per_eur: 0.86,
      meta: { source: 'test-method-1' }
    })
    .select()

  if (error1) {
    console.error('❌ Failed:', error1.message)
  } else {
    console.log('✅ Success:', data1)
  }

  // Method 2: Using .upsert() instead
  console.log('\nMethod 2: Supabase client .upsert()')
  const { data: data2, error: error2 } = await supabase
    .from('fx_rates')
    .upsert({
      as_of: '2025-01-03',
      gbp_per_eur: 0.87,
      meta: { source: 'test-method-2' }
    })
    .select()

  if (error2) {
    console.error('❌ Failed:', error2.message)
  } else {
    console.log('✅ Success:', data2)
  }

  // Method 3: Explicit column list (exclude eur_per_gbp)
  console.log('\nMethod 3: Insert with explicit DEFAULT for generated column')
  try {
    // Try using rpc to execute raw SQL
    const { data: data3, error: error3 } = await supabase.rpc('exec_sql' as any, {
      sql: `
        INSERT INTO fx_rates (as_of, gbp_per_eur, meta)
        VALUES ('2025-01-04', 0.88, '{"source": "test-method-3"}'::jsonb)
        RETURNING *
      `
    })

    if (error3) {
      console.error('❌ RPC not available:', error3.message)
    } else {
      console.log('✅ Success:', data3)
    }
  } catch (err: any) {
    console.error('❌ RPC method failed:', err.message)
  }

  // Cleanup
  console.log('\nCleaning up test data...')
  await supabase.from('fx_rates').delete().in('as_of', ['2025-01-02', '2025-01-03', '2025-01-04'])
}

main().catch(console.error)
