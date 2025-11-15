/**
 * Backfill 30-Day Medians
 * Creates historical median price data for the last 30 days
 * Uses current prices as proxy for historical data
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

async function backfillMedians() {
  console.log('📊 Backfilling 30-day median prices...\n')

  // Get all current prices from latest_market_prices
  const { data: prices, error: pricesError } = await supabase
    .from('latest_market_prices')
    .select('provider, sku, size_uk, last_sale, ask, bid, currency')

  if (pricesError) {
    console.error('❌ Error fetching prices:', pricesError.message)
    process.exit(1)
  }

  console.log(`📦 Found ${prices.length} current prices\n`)

  // Clear existing medians to avoid duplicates
  const { error: clearError } = await supabase
    .from('market_price_daily_medians')
    .delete()
    .neq('provider', 'never-match') // Delete all

  if (clearError) {
    console.log('⚠️  Could not clear existing medians:', clearError.message)
  } else {
    console.log('✓ Cleared existing medians\n')
  }

  // Generate 30 days of historical data
  const today = new Date()
  const insertions = []
  let inserted = 0
  let errors = 0

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const day = new Date(today)
    day.setDate(day.getDate() - daysAgo)
    const dayStr = day.toISOString().split('T')[0]

    for (const price of prices) {
      // Use last_sale as median, fallback to ask or bid
      const median = price.last_sale || price.ask || price.bid

      if (!median) continue

      insertions.push({
        provider: price.provider,
        sku: price.sku,
        size_uk: price.size_uk,
        day: dayStr,
        median: median,
        points: 1
      })
    }
  }

  console.log(`📝 Inserting ${insertions.length} median records...\n`)

  // Batch insert in chunks of 100
  const chunkSize = 100
  for (let i = 0; i < insertions.length; i += chunkSize) {
    const chunk = insertions.slice(i, i + chunkSize)

    const { error: insertError } = await supabase
      .from('market_price_daily_medians')
      .insert(chunk)

    if (insertError) {
      console.error(`❌ Error inserting chunk ${i / chunkSize + 1}:`, insertError.message)
      errors++
    } else {
      inserted += chunk.length
      process.stdout.write(`\r✓ Inserted ${inserted}/${insertions.length} records`)
    }
  }

  console.log('\n\n📊 Backfill Summary:')
  console.log(`  • Total records: ${insertions.length}`)
  console.log(`  • Successfully inserted: ${inserted}`)
  console.log(`  • Errors: ${errors}`)
  console.log(`  • Days covered: 30`)
  console.log(`  • Unique SKUs: ${new Set(prices.map(p => p.sku)).size}`)
  console.log('\n✅ Backfill complete!')
}

backfillMedians().catch(console.error)
