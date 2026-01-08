#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const catalogId = 'dunk-low-black-white-dd1391-100'
  const regionNames = { '1': 'US', '2': 'EU', '3': 'UK' }

  console.log('Checking Panda Dunks across regions...\n')

  for (const regionId of ['1', '2', '3']) {
    const { data: variants, count } = await supabase
      .from('inventory_v4_alias_variants')
      .select('id, size_value, size_display, region_id, consigned', { count: 'exact' })
      .eq('alias_catalog_id', catalogId)
      .eq('region_id', regionId)
      .eq('consigned', false)
      .order('size_value')
      .limit(100)

    console.log(`Region ${regionId} (${regionNames[regionId]}): ${count || 0} variants`)

    if (variants && variants.length > 0) {
      // Get market data for size 10 (common size)
      const size10 = variants.find(v => v.size_value === 10 || v.size_display === '10')
      if (size10) {
        const { data: market } = await supabase
          .from('inventory_v4_alias_market_data')
          .select('lowest_ask, highest_bid, currency_code')
          .eq('alias_variant_id', size10.id)
          .single()

        console.log(`  Size 10: ask=${market?.lowest_ask || 'N/A'} bid=${market?.highest_bid || 'N/A'} ${market?.currency_code || ''}`)
      }

      // Also show first few sizes with data
      console.log(`  First few sizes:`)
      for (const v of variants.slice(0, 3)) {
        const { data: market } = await supabase
          .from('inventory_v4_alias_market_data')
          .select('lowest_ask, currency_code')
          .eq('alias_variant_id', v.id)
          .single()

        console.log(`    ${v.size_display}: ${market?.lowest_ask ? market.currency_code + market.lowest_ask : 'no data'}`)
      }
    }
    console.log('')
  }
}

check().catch(console.error)
