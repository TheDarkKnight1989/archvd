/**
 * Check market data status for all mapped inventory items
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkStatus() {
  console.log('📊 Checking StockX Market Data Status\n')

  // Get all mapped items
  const { data: mappedItems } = await supabase
    .from('inventory_market_links')
    .select(`
      item_id,
      stockx_product_id,
      stockx_variant_id,
      Inventory!inner (
        brand,
        model,
        sku,
        size_uk
      )
    `)

  console.log(`Total mapped items: ${mappedItems?.length || 0}\n`)

  // Get all market snapshots
  const { data: snapshots } = await supabase
    .from('stockx_market_snapshots')
    .select('stockx_product_id, stockx_variant_id, currency_code')
    .order('snapshot_at', { ascending: false })

  const snapshotMap = new Map()
  snapshots?.forEach(s => {
    const key = `${s.stockx_product_id}:${s.stockx_variant_id}:${s.currency_code}`
    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, true)
    }
  })

  // Get stockx_market_latest data
  const { data: latestMarket } = await supabase
    .from('stockx_market_latest')
    .select('stockx_product_id, stockx_variant_id, currency_code, lowest_ask, highest_bid')

  const latestMap = new Map()
  latestMarket?.forEach(m => {
    const key = `${m.stockx_product_id}:${m.stockx_variant_id}:${m.currency_code}`
    latestMap.set(key, m)
  })

  console.log('┌─────────────────────────────────────────┬──────────────┬──────────────┐')
  console.log('│ Item                                    │ Snapshots    │ Latest View  │')
  console.log('├─────────────────────────────────────────┼──────────────┼──────────────┤')

  for (const item of mappedItems || []) {
    const inv = item.Inventory
    const name = `${inv.brand} ${inv.model}`.substring(0, 35)
    const key = `${item.stockx_product_id}:${item.stockx_variant_id}:GBP`

    const hasSnapshot = snapshotMap.has(key) ? '✅ Yes' : '❌ No'
    const latest = latestMap.get(key)
    const hasLatest = latest ? `✅ £${latest.lowest_ask || 'N/A'}` : '❌ No'

    console.log(`│ ${name.padEnd(39)} │ ${hasSnapshot.padEnd(12)} │ ${hasLatest.padEnd(12)} │`)
  }

  console.log('└─────────────────────────────────────────┴──────────────┴──────────────┘')

  // Show items WITHOUT market data
  const itemsWithoutData = (mappedItems || []).filter(item => {
    const key = `${item.stockx_product_id}:${item.stockx_variant_id}:GBP`
    return !latestMap.has(key)
  })

  if (itemsWithoutData.length > 0) {
    console.log(`\n❌ ${itemsWithoutData.length} items missing market data:`)
    itemsWithoutData.forEach(item => {
      const inv = item.Inventory
      console.log(`   • ${inv.brand} ${inv.model} (${inv.sku}) - Size ${inv.size_uk}`)
      console.log(`     Item ID: ${item.item_id}`)
      console.log(`     Product: ${item.stockx_product_id}`)
      console.log(`     Variant: ${item.stockx_variant_id}\n`)
    })
  } else {
    console.log('\n✅ All mapped items have market data!')
  }
}

checkStatus().catch(console.error)
