#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const styleIds = ['HQ8487-500', 'IM7410-001']

  console.log('\n🔍 CHECKING STOCK inventory_v4_stockx_products TABLE\n')

  for (const styleId of styleIds) {
    console.log(`\n${styleId}:`)

    // Check stockx_products table
    const { data, count } = await supabase
      .from('inventory_v4_stockx_products')
      .select('*', { count: 'exact' })
      .eq('style_id', styleId)

    console.log(`  Count: ${count ?? 0}`)

    if (data && data.length > 0) {
      data.forEach((p: any) => {
        console.log(`  - StockX Product ID: ${p.stockx_product_id}`)
        console.log(`    Style ID: ${p.style_id}`)
        console.log(`    Title: ${p.title}`)
      })
    }
  }

  console.log('\n')
}

check()
