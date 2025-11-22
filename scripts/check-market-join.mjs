#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n🔍 Checking stockx_market_latest join for Portfolio...\n')

const userId = 'fbcde760-820b-4eaf-949f-534a8130d44b'

// First get user's inventory IDs (inventory_market_links doesn't have user_id)
const { data: inventory, error: inventoryError } = await supabase
  .from('Inventory')
  .select('id')
  .eq('user_id', userId)

if (inventoryError) {
  console.error('❌ Error fetching inventory:', inventoryError)
  process.exit(1)
}

const inventoryIds = inventory?.map(i => i.id) || []
console.log(`✅ Found ${inventoryIds.length} inventory items for user`)

// Now get inventory_market_links for those items
const { data: links, error: linksError } = await supabase
  .from('inventory_market_links')
  .select('item_id, stockx_product_id, stockx_variant_id')
  .in('item_id', inventoryIds)

if (linksError) {
  console.error('❌ Error fetching links:', linksError)
  process.exit(1)
}

console.log(`✅ Found ${links?.length || 0} inventory_market_links`)
console.log('Sample:', JSON.stringify(links?.[0], null, 2))

// Check stockx_market_latest for these product/variant combinations
if (links && links.length > 0) {
  const link = links[0]
  console.log(`\n🔍 Checking stockx_market_latest for:`)
  console.log(`   stockx_product_id: ${link.stockx_product_id}`)
  console.log(`   stockx_variant_id: ${link.stockx_variant_id}`)
  console.log(`   currency: GBP\n`)

  const { data: marketData, error: marketError } = await supabase
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', link.stockx_product_id)
    .eq('stockx_variant_id', link.stockx_variant_id)
    .eq('currency_code', 'GBP')

  if (marketError) {
    console.error('❌ Error:', marketError)
  } else if (!marketData || marketData.length === 0) {
    console.log('❌ NO MATCH in stockx_market_latest')
    console.log('\n🔍 Checking all currencies for this product/variant:')

    const { data: allCurrencies } = await supabase
      .from('stockx_market_latest')
      .select('currency_code, last_sale_price, lowest_ask, highest_bid')
      .eq('stockx_product_id', link.stockx_product_id)
      .eq('stockx_variant_id', link.stockx_variant_id)

    console.log('Available currencies:', JSON.stringify(allCurrencies, null, 2))
  } else {
    console.log('✅ Found price data:', JSON.stringify(marketData[0], null, 2))
  }
}

// Check MV status
console.log('\n🔍 Checking materialized view status...')
const { data: mvData } = await supabase
  .from('stockx_market_latest')
  .select('*', { count: 'exact', head: true })

console.log(`Total rows in stockx_market_latest: ${mvData?.length || 0}`)
