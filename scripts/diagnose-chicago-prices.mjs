#!/usr/bin/env node
/**
 * PHASE 3.8: Diagnose Chicago Low price discrepancy
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('🔍 PHASE 3.8: Diagnosing Chicago Low Price Discrepancy\n')

// Chicago Low inventory items
const items = [
  { id: '729d9d3d-b9e2-4f1e-8286-e235624b2923', sku: 'HQ6998-600', size: '9', desc: 'Chicago Low UK 9' },
  { id: '85a1fbbd-b271-4961-b65b-4d862ec2ac23', sku: 'HQ6998-600', size: '11', desc: 'Chicago Low UK 11' },
]

for (const item of items) {
  console.log(`${'='.repeat(70)}`)
  console.log(`📦 ${item.desc} (${item.sku}:${item.size})`)
  console.log('='.repeat(70))

  // 1. Check inventory_market_links
  const { data: link } = await supabase
    .from('inventory_market_links')
    .select('*')
    .eq('item_id', item.id)
    .single()

  if (link) {
    console.log('\n✅ inventory_market_links:')
    console.log(`   stockx_product_id: ${link.stockx_product_id}`)
    console.log(`   stockx_variant_id: ${link.stockx_variant_id}`)

    // 2. Check stockx_market_snapshots
    const { data: snapshots } = await supabase
      .from('stockx_market_snapshots')
      .select('*')
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .order('snapshot_at', { ascending: false })
      .limit(1)

    if (snapshots && snapshots.length > 0) {
      const snap = snapshots[0]
      console.log('\n✅ stockx_market_snapshots (latest):')
      console.log(`   lowest_ask: £${snap.lowest_ask}`)
      console.log(`   highest_bid: £${snap.highest_bid}`)
      console.log(`   last_sale_price: ${snap.last_sale_price ? '£' + snap.last_sale_price : 'null'}`)
      console.log(`   snapshot_at: ${snap.snapshot_at}`)
    } else {
      console.log('\n❌ No snapshots found in stockx_market_snapshots')
    }

    // 3. Check stockx_market_latest
    const { data: latest } = await supabase
      .from('stockx_market_latest')
      .select('*')
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .single()

    if (latest) {
      console.log('\n✅ stockx_market_latest:')
      console.log(`   lowest_ask: £${latest.lowest_ask}`)
      console.log(`   highest_bid: £${latest.highest_bid}`)
      console.log(`   last_sale_price: ${latest.last_sale_price ? '£' + latest.last_sale_price : 'null'}`)
      console.log(`   snapshot_at: ${latest.snapshot_at}`)
    } else {
      console.log('\n❌ No row found in stockx_market_latest')
    }
  } else {
    console.log('\n❌ No mapping found in inventory_market_links')
  }

  console.log()
}

console.log('=' .repeat(70))
console.log('🔍 Now checking how Portfolio queries the data...\n')

// Check what the Portfolio query would return
const { data: portfolioData } = await supabase
  .from('Inventory')
  .select(`
    id,
    sku,
    size,
    name,
    purchase_price_cents,
    currency,
    inventory_market_links!inner (
      stockx_product_id,
      stockx_variant_id
    )
  `)
  .eq('sku', 'HQ6998-600')

console.log('Portfolio data for Chicago Low items:')
portfolioData?.forEach((item) => {
  console.log(`\n  ${item.name || item.sku}:${item.size}`)
  console.log(`    inventory_id: ${item.id}`)
  console.log(`    stockx_product_id: ${item.inventory_market_links.stockx_product_id}`)
  console.log(`    stockx_variant_id: ${item.inventory_market_links.stockx_variant_id}`)
})

console.log('\n' + '='.repeat(70))
console.log('✅ Diagnostic complete')
