import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMarketData() {
  console.log('Checking market data for DD1391-100 UK9...\n')

  // Get inventory item
  const { data: inventory } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, brand, model')
    .eq('sku', 'DD1391-100')
    .eq('size_uk', '9')
    .single()

  if (!inventory) {
    console.log('❌ Item not found in Inventory')
    return
  }

  console.log('✅ Inventory item:', inventory)

  // Check StockX mapping
  const { data: mapping } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, provider')
    .eq('item_id', inventory.id)
    .eq('provider', 'stockx')
    .single()

  if (!mapping) {
    console.log('❌ No StockX mapping found')
    return
  }

  console.log('\n✅ StockX mapping:', mapping)

  // Check market data
  const { data: marketData } = await supabase
    .from('stockx_market_latest')
    .select('*')
    .eq('stockx_product_id', mapping.stockx_product_id)
    .eq('stockx_variant_id', mapping.stockx_variant_id)
    .eq('currency_code', 'GBP')
    .single()

  if (!marketData) {
    console.log('\n❌ No StockX market data found for GBP')

    // Try other currencies
    const { data: allMarketData } = await supabase
      .from('stockx_market_latest')
      .select('currency_code, last_sale_price, lowest_ask, highest_bid')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)

    if (allMarketData?.length > 0) {
      console.log('\n📊 Market data available in other currencies:')
      console.log(allMarketData)
    } else {
      console.log('\n❌ No market data at all for this product/variant')
    }
  } else {
    console.log('\n✅ StockX market data (GBP):', {
      last_sale_price: marketData.last_sale_price,
      lowest_ask: marketData.lowest_ask,
      highest_bid: marketData.highest_bid,
      snapshot_at: marketData.snapshot_at
    })
  }
}

checkMarketData().catch(console.error)
