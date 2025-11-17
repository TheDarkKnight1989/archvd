import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkItem() {
  console.log('Searching for DD1391-100...\n')

  // Search without size constraint
  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, brand, model, colorway')
    .eq('sku', 'DD1391-100')

  if (!items || items.length === 0) {
    console.log('❌ No items found with SKU DD1391-100')
    return
  }

  console.log(`Found ${items.length} item(s):`)
  items.forEach(item => {
    console.log(`- ID: ${item.id}, Size: ${item.size_uk} (type: ${typeof item.size_uk}), Brand: ${item.brand}, Model: ${item.model}`)
  })

  // Check first item's market data
  const item = items[0]
  console.log(`\nChecking market data for item ${item.id}...`)

  const { data: mapping } = await supabase
    .from('inventory_market_links')
    .select('stockx_product_id, stockx_variant_id, provider')
    .eq('item_id', item.id)
    .eq('provider', 'stockx')
    .single()

  if (!mapping) {
    console.log('❌ No StockX mapping found')
    return
  }

  console.log('✅ StockX mapping:', mapping)

  const { data: marketData } = await supabase
    .from('stockx_market_latest')
    .select('currency_code, last_sale_price, lowest_ask, highest_bid, snapshot_at')
    .eq('stockx_product_id', mapping.stockx_product_id)
    .eq('stockx_variant_id', mapping.stockx_variant_id)

  if (!marketData || marketData.length === 0) {
    console.log('\n❌ No market data found')
  } else {
    console.log('\n✅ Market data:')
    marketData.forEach(data => {
      console.log(`  ${data.currency_code}: Last Sale=${data.last_sale_price}, Lowest Ask=${data.lowest_ask}, Highest Bid=${data.highest_bid}`)
    })
  }
}

checkItem().catch(console.error)
