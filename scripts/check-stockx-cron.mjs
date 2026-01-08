import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('📊 Checking StockX market data freshness...\n')

// Get overall stats
const { data: allData, error: allError } = await supabase
  .from('inventory_v4_stockx_market_data')
  .select('updated_at')
  .order('updated_at', { ascending: false })

if (allError) {
  console.error('❌ Error:', allError.message)
  process.exit(1)
}

if (!allData || allData.length === 0) {
  console.log('⚠️  No market data found in database')
  process.exit(0)
}

const now = new Date()
const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000)
const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000)

const newest = new Date(allData[0].updated_at)
const oldest = new Date(allData[allData.length - 1].updated_at)

const last6h = allData.filter(d => new Date(d.updated_at) > sixHoursAgo).length
const last24h = allData.filter(d => new Date(d.updated_at) > twentyFourHoursAgo).length

console.log(`Total records: ${allData.length}`)
console.log(`Newest update: ${newest.toLocaleString()} (${Math.round((now - newest) / 1000 / 60)} min ago)`)
console.log(`Oldest update: ${oldest.toLocaleString()}`)
console.log(`Updated in last 6 hours: ${last6h} (${((last6h / allData.length) * 100).toFixed(1)}%)`)
console.log(`Updated in last 24 hours: ${last24h} (${((last24h / allData.length) * 100).toFixed(1)}%)`)

// Check for stale records (older than 6 hours)
const staleCount = allData.length - last6h
console.log(`\n⚠️  Stale records (>6h old): ${staleCount}`)

if (staleCount > 0) {
  console.log('   ↳ These should be picked up by the next cron run')
}

// Show cron schedule
console.log('\n⏰ Cron Schedule:')
console.log('   Every 6 hours at :15 (00:15, 06:15, 12:15, 18:15 UTC)')
console.log('   Endpoint: /api/cron/stockx-v4-refresh')

// Calculate next run
const currentHour = now.getUTCHours()
const nextRunHour = Math.ceil((currentHour + 1) / 6) * 6
const nextRun = new Date(now)
nextRun.setUTCHours(nextRunHour === 24 ? 0 : nextRunHour, 15, 0, 0)
if (nextRunHour === 24) nextRun.setUTCDate(nextRun.getUTCDate() + 1)

console.log(`   Next scheduled run: ${nextRun.toLocaleString()} UTC (in ${Math.round((nextRun - now) / 1000 / 60)} min)`)
