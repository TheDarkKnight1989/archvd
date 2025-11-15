/**
 * Check market_price_daily_medians schema
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  // Try to select to see what columns exist
  const { data, error } = await supabase
    .from('market_price_daily_medians')
    .select('*')
    .limit(1)

  if (error) {
    console.log('Error fetching:', error.message)
  } else {
    console.log('Sample row:', data)
  }

  // Check count
  const { count } = await supabase
    .from('market_price_daily_medians')
    .select('*', { count: 'exact', head: true })

  console.log('Total rows:', count)
}

checkSchema().catch(console.error)
