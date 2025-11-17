import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUK9Items() {
  console.log('Checking UK9 items...\n')

  const { data: items } = await supabase
    .from('Inventory')
    .select('id, sku, size_uk, brand, model')
    .eq('sku', 'DD1391-100')
    .eq('size_uk', '9')

  if (!items || items.length === 0) {
    console.log('❌ No UK9 items found')
    return
  }

  console.log(`Found ${items.length} UK9 item(s)\n`)

  for (const item of items) {
    console.log(`\n--- Item ${item.id} ---`)
    console.log(`${item.brand} ${item.model} - UK${item.size_uk}`)

    // Check mapping
    const { data: mapping } = await supabase
      .from('inventory_market_links')
      .select('stockx_product_id, stockx_variant_id, provider')
      .eq('item_id', item.id)
      .eq('provider', 'stockx')
      .maybeSingle()

    if (!mapping) {
      console.log('  ❌ No StockX mapping')
      continue
    }

    console.log(`  ✅ StockX mapping: Product=${mapping.stockx_product_id}, Variant=${mapping.stockx_variant_id}`)

    // Check market data for GBP
    const { data: gbpData } = await supabase
      .from('stockx_market_latest')
      .select('last_sale_price, lowest_ask, highest_bid, snapshot_at')
      .eq('stockx_product_id', mapping.stockx_product_id)
      .eq('stockx_variant_id', mapping.stockx_variant_id)
      .eq('currency_code', 'GBP')
      .maybeSingle()

    if (gbpData) {
      console.log(`  ✅ GBP Market Data:`)
      console.log(`     Last Sale: £${gbpData.last_sale_price}`)
      console.log(`     Lowest Ask: £${gbpData.lowest_ask}`)
      console.log(`     Highest Bid: £${gbpData.highest_bid}`)
      console.log(`     Updated: ${gbpData.snapshot_at}`)
    } else {
      console.log(`  ❌ No GBP market data`)

      // Check USD
      const { data: usdData } = await supabase
        .from('stockx_market_latest')
        .select('last_sale_price, lowest_ask, highest_bid')
        .eq('stockx_product_id', mapping.stockx_product_id)
        .eq('stockx_variant_id', mapping.stockx_variant_id)
        .eq('currency_code', 'USD')
        .maybeSingle()

      if (usdData) {
        console.log(`  ℹ️  USD Market Data available:`)
        console.log(`     Last Sale: $${usdData.last_sale_price}`)
        console.log(`     Lowest Ask: $${usdData.lowest_ask}`)
        console.log(`     Highest Bid: $${usdData.highest_bid}`)
      }
    }
  }
}

checkUK9Items().catch(console.error)
