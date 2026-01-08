#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 Checking all market data tables...\n')

const tables = [
  'master_market_data',
  'alias_offer_histograms', 
  'alias_recent_sales',
  'alias_sales_detail',
  'stockx_market_data',
  'stockx_pricing_suggestions'
]

for (const table of tables) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`)
    } else {
      console.log(`✅ ${table}: ${count} rows`)
    }
  } catch (e) {
    console.log(`❌ ${table}: ${e.message}`)
  }
}
