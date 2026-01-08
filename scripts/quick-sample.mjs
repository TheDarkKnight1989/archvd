import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 DETAILED SIZE-LEVEL PRICING DATA\n')

// Get one Alias product - Nike Dunk Low
const { data: aliasProduct } = await supabase
  .from('inventory_v4_alias_products')
  .select('*')
  .eq('alias_catalog_id', 'dunk-low-black-white-dd1391-100')
  .single()

if (aliasProduct) {
  console.log(`\n📦 ${aliasProduct.brand} - ${aliasProduct.name}`)
  console.log(`   SKU: ${aliasProduct.sku}`)
  console.log(`   Retail: £${(aliasProduct.retail_price_cents / 100).toFixed(2)}`)

  const { data: variants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('*')
    .eq('alias_catalog_id', aliasProduct.alias_catalog_id)
    .limit(8)

  if (variants) {
    console.log(`\n   Live Prices Across Regions (showing 8 of 220+ sizes):`)
    for (const v of variants) {
      const { data: m } = await supabase
        .from('inventory_v4_alias_market_data')
        .select('*')
        .eq('alias_variant_id', v.alias_variant_id)
        .limit(1)
        .maybeSingle()

      if (m) {
        const ask = (m.lowest_ask_cents / 100).toFixed(2)
        const bid = (m.highest_bid_cents / 100).toFixed(2)
        console.log(`     ${v.region.toUpperCase().padEnd(3)} Size ${v.size.padEnd(5)}: ${m.currency} ${ask} (ask) / ${bid} (bid)`)
      }
    }
  }
}

// Get one StockX product - same Nike Dunk Low
const { data: stockxProduct } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*')
  .eq('style_id', 'DD1391-100')
  .maybeSingle()

if (stockxProduct) {
  console.log(`\n\n📦 ${stockxProduct.brand} - ${stockxProduct.title}`)
  console.log(`   SKU: ${stockxProduct.style_id}`)

  const { data: variants } = await supabase
    .from('inventory_v4_stockx_variants')
    .select('*')
    .eq('stockx_product_id', stockxProduct.stockx_product_id)
    .limit(8)

  if (variants) {
    console.log(`\n   Live Prices (showing 8 of ~21 sizes):`)
    for (const v of variants) {
      const { data: m } = await supabase
        .from('inventory_v4_stockx_market_data')
        .select('*')
        .eq('stockx_variant_id', v.stockx_variant_id)
        .limit(1)
        .maybeSingle()

      if (m) {
        const ask = (m.lowest_ask_cents / 100).toFixed(2)
        const bid = (m.highest_bid_cents / 100).toFixed(2)
        console.log(`     Size ${v.size_display.padEnd(5)}: ${v.currency} ${ask} (ask) / ${bid} (bid)`)
      }
    }
  }
}

console.log('\n\n📊 Key Difference:')
console.log('   • Alias: Multi-region pricing (UK/EU/US) = ~220 sizes per product')
console.log('   • StockX: Single currency (GBP) = ~21 sizes per product')
console.log('\n   Total: 39,334 size variants with live market data across both providers\n')
