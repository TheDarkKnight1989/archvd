/**
 * Check 30-day Data
 * Verify that medians and portfolio_value_daily have 30 days of data
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.USER_ID || 'fbcde760-820b-4eaf-949f-534a8130d44b'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check30DayData() {
  console.log('📊 Checking 30-day data...\n')

  // Check market_price_daily_medians
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { count: mediansCount } = await supabase
    .from('market_price_daily_medians')
    .select('*', { count: 'exact', head: true })
    .gte('day', thirtyDaysAgoStr)

  console.log(`📈 market_price_daily_medians: ${mediansCount} rows (last 30 days)`)

  // Check unique days in medians
  const { data: medianDays } = await supabase
    .from('market_price_daily_medians')
    .select('day')
    .gte('day', thirtyDaysAgoStr)
    .order('day')

  const uniqueDays = [...new Set(medianDays?.map(m => m.day) || [])]
  console.log(`   Unique days: ${uniqueDays.length}`)
  if (uniqueDays.length > 0) {
    console.log(`   Range: ${uniqueDays[0]} → ${uniqueDays[uniqueDays.length - 1]}`)
  }

  // Check portfolio_value_daily
  const { count: portfolioCount } = await supabase
    .from('portfolio_value_daily')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('day', thirtyDaysAgoStr)

  console.log(`\n💼 portfolio_value_daily: ${portfolioCount} rows (last 30 days, user ${userId})`)

  // Check unique days in portfolio
  const { data: portfolioDays } = await supabase
    .from('portfolio_value_daily')
    .select('day, total_market_value')
    .eq('user_id', userId)
    .gte('day', thirtyDaysAgoStr)
    .order('day')

  const uniquePortfolioDays = [...new Set(portfolioDays?.map(p => p.day) || [])]
  console.log(`   Unique days: ${uniquePortfolioDays.length}`)
  if (uniquePortfolioDays.length > 0) {
    console.log(`   Range: ${uniquePortfolioDays[0]} → ${uniquePortfolioDays[uniquePortfolioDays.length - 1]}`)
    console.log(`   Sample values:`)
    portfolioDays?.slice(0, 5).forEach(p => {
      console.log(`     ${p.day}: £${p.total_market_value}`)
    })
  }

  console.log('\n')

  if (uniqueDays.length >= 1 && uniquePortfolioDays.length >= 1) {
    console.log('✅ Both tables have data')
  } else {
    console.log('⚠️  Missing data - need to populate historical values')
  }
}

check30DayData().catch(console.error)
