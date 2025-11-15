#!/usr/bin/env node

/**
 * Refresh Materialized Views
 * Refreshes sneaker_price_daily_medians and portfolio_value_daily MVs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function refreshMVs() {
  console.log('🔄 Refreshing materialized views...\n')

  try {
    // Refresh unified market views (priority - new schema)
    console.log('🏪 Refreshing unified market views...')
    const { error: marketError } = await supabase.rpc('refresh_all_market_mvs')

    if (marketError) {
      console.error('❌ Error refreshing market MVs:', marketError.message)
      console.warn('⚠️  Continuing with other refreshes...\n')
    } else {
      console.log('✅ Market price daily medians + portfolio value refreshed\n')
    }

    // Refresh StockX views (legacy)
    console.log('🏪 Refreshing legacy StockX views...')
    const { error: stockxError } = await supabase.rpc('refresh_stockx_mvs')

    if (stockxError) {
      console.error('❌ Error refreshing StockX MVs:', stockxError.message)
      console.warn('⚠️  Continuing with other refreshes...\n')
    } else {
      console.log('✅ StockX views refreshed\n')
    }

    // Refresh sneaker daily medians (legacy)
    console.log('📊 Refreshing legacy sneaker_price_daily_medians...')
    const { error: sneakerError } = await supabase.rpc('refresh_sneaker_daily_medians')

    if (sneakerError) {
      console.error('❌ Error refreshing sneaker MV:', sneakerError.message)
      console.warn('⚠️  Continuing with other refreshes...\n')
    } else {
      console.log('✅ Sneaker daily medians refreshed\n')
    }

    console.log('✨ All materialized views refreshed!')

  } catch (error) {
    console.error('\n❌ Refresh failed:', error)
    process.exit(1)
  }
}

refreshMVs()
