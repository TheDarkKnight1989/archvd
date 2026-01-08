#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const styleIds = ['HQ8487-500', 'IM7410-001']

  console.log('\n🔍 DETAILED PRODUCT CHECK\n')

  for (const styleId of styleIds) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`STYLE: ${styleId}`)
    console.log('='.repeat(80))

    // Check by sku field
    const { data: bySku, count: bySkuCount } = await supabase
      .from('inventory_v4_products')
      .select('*', { count: 'exact' })
      .eq('sku', styleId)

    console.log(`\n📦 By SKU field (sku = '${styleId}'):`)
    console.log(`  Count: ${bySkuCount ?? 0}`)
    if (bySku && bySku.length > 0) {
      bySku.forEach((p: any) => {
        console.log(`  - Product ID: ${p.product_id}`)
        console.log(`    Name: ${p.name}`)
        console.log(`    SKU: ${p.sku}`)
      })
    }

    // Check by style_id field
    const { data: byStyleId, count: byStyleIdCount } = await supabase
      .from('inventory_v4_products')
      .select('*', { count: 'exact' })
      .eq('style_id', styleId)

    console.log(`\n🏷️  By style_id field (style_id = '${styleId}'):`)
    console.log(`  Count: ${byStyleIdCount ?? 0}`)
    if (byStyleId && byStyleId.length > 0) {
      byStyleId.forEach((p: any) => {
        console.log(`  - Product ID: ${p.product_id}`)
        console.log(`    Name: ${p.name}`)
        console.log(`    Style ID: ${p.style_id}`)
        console.log(`    SKU: ${p.sku}`)
      })
    }

    // Check variants
    const { count: variantCount } = await supabase
      .from('inventory_v4_variants')
      .select('*', { count: 'exact', head: true })
      .eq('style_id', styleId)

    console.log(`\n📊 Variants (style_id = '${styleId}'):`)
    console.log(`  Count: ${variantCount ?? 0}`)

    // Check if there are ANY products with similar SKU
    const { data: similar } = await supabase
      .from('inventory_v4_products')
      .select('product_id, sku, style_id, name')
      .ilike('sku', `%${styleId.substring(0, 6)}%`)
      .limit(3)

    console.log(`\n🔎 Similar SKUs (contains '${styleId.substring(0, 6)}'):`)
    if (similar && similar.length > 0) {
      similar.forEach((p: any) => {
        console.log(`  - ${p.sku} (style_id: ${p.style_id})`)
        console.log(`    Product ID: ${p.product_id}`)
      })
    } else {
      console.log(`  None found`)
    }
  }

  console.log('\n')
}

check()
