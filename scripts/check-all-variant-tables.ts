#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const styleIds = ['HQ8487-500', 'IM7410-001']

  console.log('\n🔍 COMPREHENSIVE VARIANT & MARKET DATA CHECK\n')
  console.log('='.repeat(80))

  for (const styleId of styleIds) {
    console.log(`\n📦 ${styleId}\n`)

    // Check inventory_v4_variants
    const { count: v4Variants } = await supabase
      .from('inventory_v4_variants')
      .select('*', { count: 'exact', head: true })
      .eq('style_id', styleId)

    console.log(`  inventory_v4_variants: ${v4Variants ?? 0}`)

    // Check inventory_v4_stockx_variants
    const { data: stockxVariants, count: stockxVariantCount } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('*', { count: 'exact' })
      .eq('style_id', styleId)

    console.log(`  inventory_v4_stockx_variants: ${stockxVariantCount ?? 0}`)
    if (stockxVariants && stockxVariants.length > 0) {
      const sampleSizes = stockxVariants.slice(0, 3).map((v: any) => v.size).join(', ')
      console.log(`    Sample sizes: ${sampleSizes}...`)
    }

    // Check inventory_v4_market_data
    const { count: marketData } = await supabase
      .from('inventory_v4_market_data')
      .select('*', { count: 'exact', head: true })
      .in('variant_id', stockxVariants?.map((v: any) => v.stockx_variant_id) || [])

    console.log(`  inventory_v4_market_data: ${marketData ?? 0}`)

    // Check inventory_v4_stockx_market_data
    const { count: stockxMarketData } = await supabase
      .from('inventory_v4_stockx_market_data')
      .select('*', { count: 'exact', head: true })
      .eq('style_id', styleId)

    console.log(`  inventory_v4_stockx_market_data: ${stockxMarketData ?? 0}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Check complete\n')
}

check()
