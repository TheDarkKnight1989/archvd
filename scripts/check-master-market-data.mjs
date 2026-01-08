#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 Checking master_market_data table...\n')

// Check if table exists and count rows
const { count, error } = await supabase
  .from('master_market_data')
  .select('*', { count: 'exact', head: true })

if (error) {
  console.log(`❌ Error: ${error.message}`)
} else {
  console.log(`✅ master_market_data exists with ${count} rows`)
  
  // Get sample data
  const { data: sample } = await supabase
    .from('master_market_data')
    .select('*')
    .limit(2)
  
  if (sample && sample.length > 0) {
    console.log('\n📋 Sample row schema:')
    console.log(Object.keys(sample[0]).join(', '))
  }
}

// Check market_snapshots (new table from migration)
const { count: snapshotCount, error: snapError } = await supabase
  .from('market_snapshots')
  .select('*', { count: 'exact', head: true })

if (snapError) {
  console.log(`\n❌ market_snapshots error: ${snapError.message}`)
} else {
  console.log(`\n✅ market_snapshots exists with ${snapshotCount || 0} rows`)
}
