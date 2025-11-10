#!/usr/bin/env node

/**
 * Verify Materialized Views Data
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verify() {
  console.log('🔍 Verifying materialized views...\n')

  try {
    // Check sneaker_price_daily_medians
    const { data: sneakerData, error: sneakerError } = await supabase
      .from('sneaker_price_daily_medians')
      .select('sku, size, day, median_price')
      .limit(5)

    if (sneakerError) throw sneakerError

    console.log('📊 sneaker_price_daily_medians sample:')
    console.table(sneakerData)

    const { count: sneakerCount } = await supabase
      .from('sneaker_price_daily_medians')
      .select('*', { count: 'exact', head: true })

    console.log(`✅ Total rows in sneaker_price_daily_medians: ${sneakerCount}\n`)

    // Check portfolio_value_daily
    const { data: portfolioData, error: portfolioError } = await supabase
      .from('portfolio_value_daily')
      .select('user_id, day, value_base_gbp, item_count')
      .limit(5)

    if (portfolioError) throw portfolioError

    console.log('💼 portfolio_value_daily sample:')
    console.table(portfolioData)

    const { count: portfolioCount } = await supabase
      .from('portfolio_value_daily')
      .select('*', { count: 'exact', head: true })

    console.log(`✅ Total rows in portfolio_value_daily: ${portfolioCount}\n`)

    console.log('✨ Verification complete!')

  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  }
}

verify()
