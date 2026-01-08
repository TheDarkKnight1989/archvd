import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const catalogIds = [
  '2002r-protection-pack-phantom-m2002rdb',
  '2002r-protection-pack-rain-cloud-m2002rda',
  '9060-black-castlerock-u9060blk',
  '9060-triple-black-u9060bpm',
  'a-ma-maniere-x-wmns-air-jordan-3-retro-black-violet-ore-fz4811-001',
  'a-ma-maniere-x-wmns-air-jordan-3-retro-sp-violet-ore-dh3434-110',
  'a-ma-maniere-x-wmns-air-jordan-4-retro-fossil-stone-fz4810-200',
  'air-jordan-1-retro-high-og-black-toe-reimagined-dz5485-061',
  'air-jordan-1-retro-high-og-shattered-backboard-2025-dz5485-008',
  'air-jordan-1-retro-low-og-chicago-2025-hq6998-600',
  'air-jordan-10-retro-shadow-2025-hj6779-001',
  'air-jordan-11-retro-columbia-2024-ct8012-104'
]

console.log('\n🔍 Checking Live Market Data for First 12 Synced Products\n')
console.log('='.repeat(80))

for (const catalogId of catalogIds) {
  const { data, error, count } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('*', { count: 'exact', head: false })
    .eq('catalog_id', catalogId)
    .limit(1)

  if (error) {
    console.log(`❌ ${catalogId}: Error - ${error.message}`)
  } else if (count === 0) {
    console.log(`⏳ ${catalogId}: No data yet (0 rows)`)
  } else {
    const record = data[0]
    const timestamp = new Date(record.updated_at).toLocaleTimeString()
    console.log(`✅ ${catalogId}: ${count} rows | Last: ${timestamp} | Region: ${record.region_id}`)
  }
}

// Get total count
const { count: totalCount } = await supabase
  .from('inventory_v4_alias_market_data')
  .select('*', { count: 'exact', head: true })
  .in('catalog_id', catalogIds)

console.log('\n' + '='.repeat(80))
console.log(`📊 Total market data records for these 12 products: ${totalCount || 0}`)
console.log('='.repeat(80))
