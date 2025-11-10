#!/usr/bin/env tsx

/**
 * Test updating the existing fx_rates row
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

  console.log('Testing update on existing row...\n')

  // Update the existing row with a new gbp_per_eur value
  const { data, error } = await supabase
    .from('fx_rates')
    .update({
      gbp_per_eur: 0.84
    })
    .eq('as_of', '2025-11-09')
    .select()

  if (error) {
    console.error('❌ Update failed:', error)
  } else {
    console.log('✅ Update successful:')
    console.table(data)
    console.log('\nExpected eur_per_gbp:', 1.0 / 0.84, '≈', (1.0 / 0.84).toFixed(6))
    console.log('Actual eur_per_gbp:', data[0]?.eur_per_gbp)
  }
}

main().catch(console.error)
