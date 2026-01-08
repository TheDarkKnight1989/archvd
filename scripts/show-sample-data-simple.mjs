import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 SAMPLE SKUs AND SIZE-LEVEL DATA\n')
console.log('='.repeat(100))

// Get Alias products without ordering
const { data: aliasProducts, error: aliasError } = await supabase
  .from('inventory_v4_alias_products')
  .select('alias_catalog_id, style_id, brand, name')
  .limit(3)

console.log('\n📦 ALIAS PRODUCTS\n')

if (aliasError) {
  console.log('Error fetching Alias products:', aliasError.message)
} else if (!aliasProducts || aliasProducts.length === 0) {
  console.log('No Alias products found')
} else {
  for (const product of aliasProducts) {
    console.log(`\n${product.brand} - ${product.name}`)
    console.log(`  SKU: ${product.style_id}`)
    console.log(`  Catalog ID: ${product.alias_catalog_id}`)

    // Get 5 sample variants
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('alias_variant_id, size, region')
      .eq('alias_catalog_id', product.alias_catalog_id)
      .limit(5)

    if (variants && variants.length > 0) {
      console.log(`  Sample sizes (${variants.length} shown):`)

      for (const variant of variants) {
        // Get latest market data
        const { data: market } = await supabase
          .from('inventory_v4_alias_market_data')
          .select('lowest_ask_cents, highest_bid_cents, currency')
          .eq('alias_variant_id', variant.alias_variant_id)
          .limit(1)
          .maybeSingle()

        if (market) {
          const ask = (market.lowest_ask_cents / 100).toFixed(2)
          const bid = (market.highest_bid_cents / 100).toFixed(2)
          console.log(`    • ${variant.region.toUpperCase()} Size ${variant.size}: ${market.currency} ${ask} (ask) / ${bid} (bid)`)
        } else {
          console.log(`    • ${variant.region.toUpperCase()} Size ${variant.size}: No market data`)
        }
      }
    }
    console.log('')
  }
}

console.log('\n' + '='.repeat(100))
console.log('\n📦 STOCKX PRODUCTS\n')

// Get StockX products
const { data: stockxProducts, error: stockxError } = await supabase
  .from('inventory_v4_stockx_products')
  .select('stockx_product_id, style_id, brand, name')
  .limit(2)

if (stockxError) {
  console.log('Error fetching StockX products:', stockxError.message)
} else if (!stockxProducts || stockxProducts.length === 0) {
  console.log('No StockX products found')
} else {
  for (const product of stockxProducts) {
    console.log(`\n${product.brand} - ${product.name}`)
    console.log(`  SKU: ${product.style_id}`)

    // Get 5 sample variants
    const { data: variants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id, size_display, currency')
      .eq('stockx_product_id', product.stockx_product_id)
      .limit(5)

    if (variants && variants.length > 0) {
      console.log(`  Sample sizes (${variants.length} shown):`)

      for (const variant of variants) {
        const { data: market } = await supabase
          .from('inventory_v4_stockx_market_data')
          .select('lowest_ask_cents, highest_bid_cents')
          .eq('stockx_variant_id', variant.stockx_variant_id)
          .limit(1)
          .maybeSingle()

        if (market) {
          const ask = (market.lowest_ask_cents / 100).toFixed(2)
          const bid = (market.highest_bid_cents / 100).toFixed(2)
          console.log(`    • Size ${variant.size_display}: ${variant.currency} ${ask} (ask) / ${bid} (bid)`)
        } else {
          console.log(`    • Size ${variant.size_display}: No market data`)
        }
      }
    }
    console.log('')
  }
}

console.log('\n' + '='.repeat(100))
console.log('\n📊 TOTALS')
console.log('='.repeat(100))

const { count: aliasCount } = await supabase
  .from('inventory_v4_alias_products')
  .select('*', { count: 'exact', head: true })

const { count: aliasVariantCount } = await supabase
  .from('inventory_v4_alias_variants')
  .select('*', { count: 'exact', head: true })

const { count: aliasMarketCount } = await supabase
  .from('inventory_v4_alias_market_data')
  .select('*', { count: 'exact', head: true })

const { count: stockxCount } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*', { count: 'exact', head: true })

const { count: stockxVariantCount } = await supabase
  .from('inventory_v4_stockx_variants')
  .select('*', { count: 'exact', head: true })

const { count: stockxMarketCount } = await supabase
  .from('inventory_v4_stockx_market_data')
  .select('*', { count: 'exact', head: true })

console.log(`\nAlias:`)
console.log(`  ${aliasCount || 0} products`)
console.log(`  ${aliasVariantCount || 0} size variants`)
console.log(`  ${aliasMarketCount || 0} market data records`)

console.log(`\nStockX:`)
console.log(`  ${stockxCount || 0} products`)
console.log(`  ${stockxVariantCount || 0} size variants`)
console.log(`  ${stockxMarketCount || 0} market data records`)

console.log('\n' + '='.repeat(100))
console.log('\n✅ Done!\n')
