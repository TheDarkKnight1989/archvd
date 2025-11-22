/**
 * Sync specific inventory items with StockX market data
 * Usage: node scripts/sync-items.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
})

const INVENTORY_ITEMS = [
  '3c386636-f732-401e-9d78-201f36a217f2',
  'b732c556-687e-431f-9173-e9bfe0f02c8b',
  'bb656212-4ee2-4e74-961a-94a33d56aeda',
]

async function syncItems() {
  console.log('🚀 Starting StockX market data sync for 3 items...\n')

  for (const itemId of INVENTORY_ITEMS) {
    console.log(`\n📦 Syncing item: ${itemId}`)

    try {
      // Get item details first
      const { data: item, error: itemError } = await supabase
        .from('Inventory')
        .select('id, sku, brand, model, size_uk')
        .eq('id', itemId)
        .single()

      if (itemError) {
        console.error(`  ❌ Failed to fetch item: ${itemError.message}`)
        continue
      }

      console.log(`  → ${item.brand} ${item.model} (${item.sku}) - Size: ${item.size_uk}`)

      // Get StockX mapping
      const { data: mapping, error: mappingError } = await supabase
        .from('inventory_market_links')
        .select('stockx_product_id, stockx_variant_id')
        .eq('item_id', itemId)
        .single()

      if (mappingError) {
        console.error(`  ❌ No StockX mapping found: ${mappingError.message}`)
        continue
      }

      console.log(`  → StockX Product: ${mapping.stockx_product_id}`)
      console.log(`  → StockX Variant: ${mapping.stockx_variant_id}`)

      // Fetch market data from StockX API v2
      const stockxUrl = `https://stockx-api.vercel.app/v2/products/${mapping.stockx_product_id}/market/GBP`
      console.log(`  → Fetching from: ${stockxUrl}`)

      const response = await fetch(stockxUrl)
      if (!response.ok) {
        throw new Error(`StockX API returned ${response.status}`)
      }

      const data = await response.json()

      if (!data.success || !data.variants || data.variants.length === 0) {
        console.error(`  ❌ No variants found in StockX response`)
        continue
      }

      // Find matching variant
      const variant = data.variants.find(v => v.variantId === mapping.stockx_variant_id)

      if (!variant) {
        console.error(`  ❌ Variant ${mapping.stockx_variant_id} not found in response`)
        continue
      }

      console.log(`  ✅ Found market data:`)
      console.log(`     Lowest Ask: £${variant.lowestAsk || 'N/A'}`)
      console.log(`     Highest Bid: £${variant.highestBid || 'N/A'}`)

      // Insert into stockx_market_snapshots
      const { error: insertError } = await supabase
        .from('stockx_market_snapshots')
        .insert({
          stockx_product_id: mapping.stockx_product_id,
          stockx_variant_id: mapping.stockx_variant_id,
          currency_code: 'GBP',
          lowest_ask: variant.lowestAsk || null,
          highest_bid: variant.highestBid || null,
          sales_last_72h: variant.salesLast72h || null,
          snapshot_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error(`  ❌ Failed to insert snapshot: ${insertError.message}`)
        continue
      }

      console.log(`  ✅ Market snapshot created successfully`)

    } catch (error) {
      console.error(`  ❌ Error syncing item: ${error.message}`)
    }
  }

  // Refresh materialized view
  console.log('\n🔄 Refreshing stockx_market_latest materialized view...')

  const { error: refreshError } = await supabase.rpc('refresh_stockx_market_latest')

  if (refreshError) {
    console.error(`❌ Failed to refresh view: ${refreshError.message}`)
  } else {
    console.log('✅ Materialized view refreshed successfully')
  }

  // Verify results
  console.log('\n🔍 Verifying market data in stockx_market_latest...')

  for (const itemId of INVENTORY_ITEMS) {
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id')
      .eq('item_id', itemId)
      .single()

    if (!mapping) continue

    const { data: marketData, error: marketError } = await supabase
      .from('stockx_market_latest')
      .select('lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .single()

    if (marketError) {
      console.error(`❌ Item ${itemId}: No market data found`)
    } else {
      console.log(`✅ Item ${itemId}:`)
      console.log(`   Lowest Ask: £${marketData.lowest_ask || 'N/A'}`)
      console.log(`   Highest Bid: £${marketData.highest_bid || 'N/A'}`)
      console.log(`   Updated: ${marketData.snapshot_at}`)
    }
  }

  console.log('\n✨ Sync complete!')
}

syncItems().catch(console.error)
