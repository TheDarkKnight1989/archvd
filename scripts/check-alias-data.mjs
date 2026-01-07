import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  // Get alias_catalog_id for DZ4137-106
  const { data: catalog } = await supabase
    .from('inventory_v4_style_catalog')
    .select('alias_catalog_id')
    .eq('style_id', 'DZ4137-106')
    .single()

  console.log('Alias catalog_id for DZ4137-106:', catalog?.alias_catalog_id)

  if (!catalog?.alias_catalog_id) {
    console.log('No alias mapping found')
    return
  }

  // Query alias_market_snapshots for US region (1) and UK region (3)
  // Size is 13.5W for women's
  const { data, error } = await supabase
    .from('alias_market_snapshots')
    .select('*')
    .eq('catalog_id', catalog.alias_catalog_id)
    .in('size', ['13.5', '13.5W', 13.5])
    .order('region_id')

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('')
  console.log('=== alias_market_snapshots for size 13.5 ===')
  console.log('Found', data.length, 'rows')

  for (const row of data) {
    const region = row.region_id === '1' ? 'US' : row.region_id === '3' ? 'UK' : row.region_id
    console.log('')
    console.log('Region:', region, '(' + row.region_id + ') | Size:', row.size, '| Currency:', row.currency)
    console.log('  lowest_ask_cents:', row.lowest_ask_cents, '=', row.lowest_ask_cents ? '$' + (row.lowest_ask_cents/100).toFixed(2) : 'null')
    console.log('  highest_bid_cents:', row.highest_bid_cents, '=', row.highest_bid_cents ? '$' + (row.highest_bid_cents/100).toFixed(2) : 'null')
    console.log('  snapshot_at:', row.snapshot_at)
  }
}
check()
