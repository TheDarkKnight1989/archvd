#!/usr/bin/env tsx

/**
 * Check fx_rates table schema to debug generated column issue
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

  console.log('Checking fx_rates table...\n')

  // Check if table has any existing data
  const { data: existingData, error: selectError } = await supabase
    .from('fx_rates')
    .select('*')
    .limit(5)

  if (selectError) {
    console.error('Error querying fx_rates:', selectError)
  } else {
    console.log(`Found ${existingData?.length || 0} existing rows:`)
    if (existingData && existingData.length > 0) {
      console.table(existingData)
    }
  }

  // Try to insert a test row
  console.log('\nAttempting test insert...')
  const { data: insertData, error: insertError } = await supabase
    .from('fx_rates')
    .insert({
      as_of: '2025-01-01',
      gbp_per_eur: 0.85,
      meta: { source: 'test' }
    })
    .select()

  if (insertError) {
    console.error('Insert error:', insertError)
  } else {
    console.log('Insert successful:', insertData)

    // Clean up test data
    await supabase
      .from('fx_rates')
      .delete()
      .eq('as_of', '2025-01-01')
  }
}

main().catch(console.error)
