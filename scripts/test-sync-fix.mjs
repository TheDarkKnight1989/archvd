import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const catalogId = 'solefly-x-air-jordan-3-miami-if4491-100'

async function testSyncFix() {
  console.log('=== BEFORE: Check existing market data ===')
  
  // Get variants
  const { data: variants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('id, region_id, size_display, consigned')
    .eq('alias_catalog_id', catalogId)
  
  console.log('Total variants:', variants?.length || 0)
  
  // Get market data
  const ids = variants?.map(v => v.id) || []
  const { data: marketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, last_sale_price')
    .in('alias_variant_id', ids)
  
  // Count by region
  const byRegion = {}
  variants?.forEach(v => {
    const m = marketData?.find(md => md.alias_variant_id === v.id)
    const hasPrice = m && (m.lowest_ask || m.last_sale_price)
    const key = `region_${v.region_id}`
    if (!byRegion[key]) byRegion[key] = { total: 0, withPrices: 0 }
    byRegion[key].total++
    if (hasPrice) byRegion[key].withPrices++
  })
  
  console.log('\nMarket data by region:')
  Object.entries(byRegion).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.withPrices}/${v.total} with prices`)
  })
  
  // Clear market data to force resync
  console.log('\n=== Clearing market data for resync ===')
  await supabase
    .from('inventory_v4_alias_market_data')
    .delete()
    .in('alias_variant_id', ids)
  console.log('Cleared', ids.length, 'market data rows')
  
  // Call the sync API
  console.log('\n=== Calling sync API ===')
  const response = await fetch('http://localhost:3000/api/alias/sync/master-market-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogId, forceRefresh: true })
  })
  
  const result = await response.json()
  console.log('Sync result:', JSON.stringify(result, null, 2))
  
  // Check results
  console.log('\n=== AFTER: Check market data ===')
  const { data: newMarketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, last_sale_price')
    .in('alias_variant_id', ids)
  
  // Count by region again
  const afterByRegion = {}
  variants?.forEach(v => {
    const m = newMarketData?.find(md => md.alias_variant_id === v.id)
    const hasPrice = m && (m.lowest_ask || m.last_sale_price)
    const key = `region_${v.region_id}`
    if (!afterByRegion[key]) afterByRegion[key] = { total: 0, withPrices: 0 }
    afterByRegion[key].total++
    if (hasPrice) afterByRegion[key].withPrices++
  })
  
  console.log('\nMarket data by region after sync:')
  Object.entries(afterByRegion).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.withPrices}/${v.total} with prices`)
  })
}

testSyncFix().catch(console.error)
