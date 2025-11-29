// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function refreshMaterializedViews() {
  console.log('=== Refreshing Materialized Views ===\n')

  try {
    // Refresh sneaker_price_daily_medians first (portfolio_value_daily depends on it)
    console.log('Refreshing sneaker_price_daily_medians...')
    const { error: sneakerError } = await supabase.rpc('refresh_sneaker_daily_medians')

    if (sneakerError) {
      console.error('❌ Error refreshing sneaker_price_daily_medians:', sneakerError.message)
    } else {
      console.log('✅ sneaker_price_daily_medians refreshed successfully')
    }

    // Refresh portfolio_value_daily
    console.log('\nRefreshing portfolio_value_daily...')
    const { error: portfolioError } = await supabase.rpc('refresh_portfolio_value_daily', { p_user_id: null })

    if (portfolioError) {
      console.error('❌ Error refreshing portfolio_value_daily:', portfolioError.message)
    } else {
      console.log('✅ portfolio_value_daily refreshed successfully')
    }

    // Verify portfolio_value_daily now has data
    console.log('\nVerifying portfolio_value_daily...')
    const { data, error } = await supabase
      .from('portfolio_value_daily')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Error querying view:', error.message)
    } else if (data && data.length > 0) {
      console.log('✅ Portfolio view populated with columns:', Object.keys(data[0]))
      console.log('\nSample row:', JSON.stringify(data[0], null, 2))
    } else {
      console.log('⚠️  View is now accessible but contains no data (may be expected if no inventory exists)')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

refreshMaterializedViews().catch(console.error)
