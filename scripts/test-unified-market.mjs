import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('═══════════════════════════════════════════════════════════')
console.log('  UNIFIED MARKET DATA - PROOF OF CONCEPT')
console.log('═══════════════════════════════════════════════════════════\n')

// Test single SKU function
console.log('1️⃣  Testing get_unified_market_data(\'DD1391-100\')...\n')
const { data, error } = await supabase.rpc('get_unified_market_data', {
  p_style_id: 'DD1391-100',
  p_alias_region: '1',
  p_consigned: false
})

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log(`✅ Returned ${data?.length || 0} sizes\n`)

// Find rows with both providers
const bothProviders = data?.filter(r => r.has_stockx && r.has_alias) || []
const stockxOnly = data?.filter(r => r.has_stockx && !r.has_alias) || []
const aliasOnly = data?.filter(r => !r.has_stockx && r.has_alias) || []

console.log('Coverage breakdown:')
console.log(`  • Both StockX + Alias: ${bothProviders.length} sizes`)
console.log(`  • StockX only: ${stockxOnly.length} sizes`)
console.log(`  • Alias only: ${aliasOnly.length} sizes`)

// Show sample with both providers
if (bothProviders.length > 0) {
  console.log('\n📊 Sample row with BOTH providers (size 10):')
  const sample = bothProviders.find(r => r.size_display === '10') || bothProviders[0]
  console.log('  ┌─────────────┬──────────────┬──────────────┐')
  console.log('  │             │   StockX     │    Alias     │')
  console.log('  ├─────────────┼──────────────┼──────────────┤')
  console.log(`  │ Size        │ ${sample.size_display.padEnd(12)} │ ${sample.size_display.padEnd(12)} │`)
  console.log(`  │ Lowest Ask  │ ${(sample.stockx_lowest_ask?.toString() || '-').padEnd(12)} │ ${(sample.alias_lowest_ask?.toString() || '-').padEnd(12)} │`)
  console.log(`  │ Highest Bid │ ${(sample.stockx_highest_bid?.toString() || '-').padEnd(12)} │ ${(sample.alias_highest_bid?.toString() || '-').padEnd(12)} │`)
  console.log(`  │ Currency    │ ${(sample.stockx_currency || '-').padEnd(12)} │ ${(sample.alias_currency || '-').padEnd(12)} │`)
  console.log('  └─────────────┴──────────────┴──────────────┘')
}

// Test batch function
console.log('\n───────────────────────────────────────────────────────────')
console.log('2️⃣  Testing get_unified_market_data_batch()...\n')

const { data: batchData, error: batchError } = await supabase.rpc('get_unified_market_data_batch', {
  p_style_ids: ['DD1391-100', 'DZ5485-612'],
  p_sizes: ['9', '9.5', '10', '10.5', '11'],
  p_alias_region: '1',
  p_consigned: false
})

if (batchError) {
  console.error('❌ Batch Error:', batchError.message)
  process.exit(1)
}

console.log(`✅ Returned ${batchData?.length || 0} rows for 2 SKUs × 5 sizes\n`)

if (batchData?.length > 0) {
  console.log('📋 Batch results:')
  console.log('  ┌──────────────┬───────┬────────────┬────────────┐')
  console.log('  │ SKU          │ Size  │ StockX Ask │ Alias Ask  │')
  console.log('  ├──────────────┼───────┼────────────┼────────────┤')
  for (const row of batchData.slice(0, 8)) {
    const sku = row.style_id.substring(0, 12).padEnd(12)
    const size = row.size_display.padEnd(5)
    const sxAsk = (row.stockx_lowest_ask?.toString() || '-').padEnd(10)
    const alAsk = (row.alias_lowest_ask?.toString() || '-').padEnd(10)
    console.log(`  │ ${sku} │ ${size} │ ${sxAsk} │ ${alAsk} │`)
  }
  console.log('  └──────────────┴───────┴────────────┴────────────┘')
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log('  ✅ ALL TESTS PASSED - Unified Market Data is LIVE')
console.log('═══════════════════════════════════════════════════════════')
