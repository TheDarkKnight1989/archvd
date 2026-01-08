import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function debug() {
  // Get V4 items
  const { data: items } = await supabase
    .from('inventory_v4_items')
    .select('id, style_id, size, size_unit, style:inventory_v4_style_catalog(*)')

  console.log('=== V4 Items with size info ===')
  for (const item of items || []) {
    console.log('\nItem:', item.style_id)
    console.log('  Size:', item.size, item.size_unit)
    console.log('  Style name:', (item.style)?.name?.substring(0, 50))
    console.log('  Style gender:', (item.style)?.gender)
  }

  // Check specific Travis Scott + Sean Wotherspoon
  const testItems = [
    { sku: 'DZ4137-106', name: 'Travis Scott' },
    { sku: 'AJ4219-400', name: 'Sean Wotherspoon' }
  ]

  console.log('\n=== Detailed lookup for specific items ===')

  for (const test of testItems) {
    const item = items?.find(i => i.style_id === test.sku)
    if (item === undefined) {
      console.log('\n' + test.name + ': NOT FOUND IN V4 ITEMS')
      continue
    }

    console.log('\n' + test.name + ' (' + test.sku + '):')
    console.log('  Item size:', item.size, item.size_unit)
    console.log('  Style gender:', (item.style)?.gender)

    // Try to get market data for this specific item
    const { data: marketData } = await supabase.rpc('get_unified_market_data', {
      p_style_id: test.sku,
      p_alias_region: '1', // UK
      p_consigned: false,
      p_stockx_currency: 'GBP'
    })

    // What size should we be looking for?
    console.log('  Available sizes in market data:', marketData?.slice(0, 10).map(r => r.size_display).join(', '))

    // Check if item's size exists in market data
    const matchingSize = marketData?.find(r => {
      const display = r.size_display
      const itemSize = item.size
      // Try various matching
      return display === itemSize ||
             display === itemSize + 'W' ||
             parseFloat(display) === parseFloat(itemSize)
    })

    if (matchingSize) {
      console.log('  FOUND matching size:', matchingSize.size_display)
      console.log('    alias_lowest_ask:', matchingSize.alias_lowest_ask)
      console.log('    alias_highest_bid:', matchingSize.alias_highest_bid)
    } else {
      console.log('  NO MATCHING SIZE FOUND for item size:', item.size, item.size_unit)
      // Show what we'd need to match
      const itemSizeNum = parseFloat(item.size)
      console.log('  Need to match (approx):', itemSizeNum, 'or', itemSizeNum + 'W')
    }
  }
}

debug()
