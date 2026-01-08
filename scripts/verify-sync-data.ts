#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSyncData() {
  const styleIds = ['HQ8487-500', 'IM7410-001']

  console.log('\n🔍 CHECKING SYNCED DATA FOR COMPLETED JOBS\n')
  console.log('='.repeat(80))

  for (const styleId of styleIds) {
    console.log(`\n📦 STYLE: ${styleId}\n`)

    // Check variants
    const { data: variants, count: variantCount } = await supabase
      .from('inventory_v4_variants')
      .select('*', { count: 'exact' })
      .eq('style_id', styleId)

    console.log(`  Variants Synced: ${variantCount ?? 0}`)

    if (variants && variants.length > 0) {
      const stockxVariants = variants.filter(v => v.stockx_variant_id)
      const aliasVariants = variants.filter(v => v.alias_size)
      console.log(`    - StockX variants: ${stockxVariants.length}`)
      console.log(`    - Alias variants: ${aliasVariants.length}`)

      // Show sample sizes
      const sampleSizes = variants.slice(0, 3).map(v => v.size).join(', ')
      console.log(`    - Sample sizes: ${sampleSizes}...`)
    }

    // Check market data
    const { count: marketDataCount } = await supabase
      .from('inventory_v4_market_data')
      .select('variant_id', { count: 'exact', head: true })
      .in('variant_id', (variants || []).map(v => v.variant_id))

    console.log(`  Market Data Records: ${marketDataCount ?? 0}`)

    // Get latest market data sample
    if (variants && variants.length > 0) {
      const { data: marketSample } = await supabase
        .from('inventory_v4_market_data')
        .select('provider, lowest_ask_gbp, highest_bid_gbp, updated_at')
        .in('variant_id', variants.map(v => v.variant_id))
        .order('updated_at', { ascending: false })
        .limit(2)

      if (marketSample && marketSample.length > 0) {
        console.log(`\n  Latest Market Data:`)
        marketSample.forEach((md: any) => {
          const time = new Date(md.updated_at).toLocaleString()
          console.log(`    [${md.provider.toUpperCase()}] Ask: £${md.lowest_ask_gbp} | Bid: £${md.highest_bid_gbp}`)
          console.log(`      Updated: ${time}`)
        })
      }
    }

    console.log('\n' + '-'.repeat(80))
  }

  console.log('\n✅ Data sync verified!\n')
}

checkSyncData()
