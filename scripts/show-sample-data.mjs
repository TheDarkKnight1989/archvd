import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 SAMPLE SKUs AND SIZE-LEVEL DATA\n')
console.log('='.repeat(100))

// First, get 3 actual products from the database
const { data: actualProducts } = await supabase
  .from('inventory_v4_alias_products')
  .select('alias_catalog_id, style_id, brand, name')
  .order('updated_at', { ascending: false })
  .limit(3)

if (!actualProducts || actualProducts.length === 0) {
  console.log('No Alias products found in database')
} else {
  for (const product of actualProducts) {
    console.log(`\n📦 ${product.brand} - ${product.name}`)
    console.log('-'.repeat(100))
    console.log(`  SKU: ${product.style_id}`)
    console.log(`  Catalog ID: ${product.alias_catalog_id}`)

    // Get variant count
    const { count: variantCount } = await supabase
      .from('inventory_v4_alias_variants')
      .select('*', { count: 'exact', head: true })
      .eq('alias_catalog_id', product.alias_catalog_id)

    console.log(`  Total sizes: ${variantCount || 0}`)

    // Get sample variants with market data
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('alias_variant_id, size, region')
      .eq('alias_catalog_id', product.alias_catalog_id)
      .order('region')
      .limit(6)

    if (variants && variants.length > 0) {
      console.log(`\n  📏 Sample sizes with current market data:`)

      for (const variant of variants) {
        const { data: marketData } = await supabase
          .from('inventory_v4_alias_market_data')
          .select('lowest_ask_cents, highest_bid_cents, currency')
          .eq('alias_variant_id', variant.alias_variant_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (marketData) {
          const ask = (marketData.lowest_ask_cents / 100).toFixed(2)
          const bid = (marketData.highest_bid_cents / 100).toFixed(2)
          console.log(`    • ${variant.region.toUpperCase()} Size ${variant.size.padEnd(6)}: Ask ${marketData.currency} ${ask} | Bid ${marketData.currency} ${bid}`)
        }
      }
    }
  }
}

console.log('\n' + '='.repeat(100))
console.log('\n📦 STOCKX SAMPLE DATA\n')
console.log('='.repeat(100))

// Get StockX products
const { data: stockxProducts } = await supabase
  .from('inventory_v4_stockx_products')
  .select('stockx_product_id, style_id, brand, name')
  .order('updated_at', { ascending: false })
  .limit(2)

if (!stockxProducts || stockxProducts.length === 0) {
  console.log('No StockX products found in database')
} else {
  for (const product of stockxProducts) {
    console.log(`\n📦 ${product.brand} - ${product.name}`)
    console.log('-'.repeat(100))
    console.log(`  SKU: ${product.style_id}`)
    console.log(`  Product ID: ${product.stockx_product_id}`)

    // Get variant count
    const { count: variantCount } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('*', { count: 'exact', head: true })
      .eq('stockx_product_id', product.stockx_product_id)

    console.log(`  Total sizes: ${variantCount || 0}`)

    // Get sample variants
    const { data: variants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id, size_display, currency')
      .eq('stockx_product_id', product.stockx_product_id)
      .limit(6)

    if (variants && variants.length > 0) {
      console.log(`\n  📏 Sample sizes with current market data:`)

      for (const variant of variants) {
        const { data: marketData } = await supabase
          .from('inventory_v4_stockx_market_data')
          .select('lowest_ask_cents, highest_bid_cents')
          .eq('stockx_variant_id', variant.stockx_variant_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (marketData) {
          const ask = (marketData.lowest_ask_cents / 100).toFixed(2)
          const bid = (marketData.highest_bid_cents / 100).toFixed(2)
          console.log(`    • Size ${variant.size_display.padEnd(6)}: Ask ${variant.currency} ${ask} | Bid ${variant.currency} ${bid}`)
        }
      }
    }
  }
}

console.log('\n' + '='.repeat(100))

// Summary stats
console.log('\n📊 DATABASE SUMMARY\n')
console.log('='.repeat(100))

const { count: aliasProductCount } = await supabase
  .from('inventory_v4_alias_products')
  .select('*', { count: 'exact', head: true })

const { count: aliasVariantCount } = await supabase
  .from('inventory_v4_alias_variants')
  .select('*', { count: 'exact', head: true })

const { count: aliasMarketCount } = await supabase
  .from('inventory_v4_alias_market_data')
  .select('*', { count: 'exact', head: true })

const { count: stockxProductCount } = await supabase
  .from('inventory_v4_stockx_products')
  .select('*', { count: 'exact', head: true })

const { count: stockxVariantCount } = await supabase
  .from('inventory_v4_stockx_variants')
  .select('*', { count: 'exact', head: true })

const { count: stockxMarketCount } = await supabase
  .from('inventory_v4_stockx_market_data')
  .select('*', { count: 'exact', head: true })

console.log('Alias:')
console.log(`  Products: ${aliasProductCount || 0}`)
console.log(`  Variants: ${aliasVariantCount || 0}`)
console.log(`  Market Data Records: ${aliasMarketCount || 0}`)

console.log('\nStockX:')
console.log(`  Products: ${stockxProductCount || 0}`)
console.log(`  Variants: ${stockxVariantCount || 0}`)
console.log(`  Market Data Records: ${stockxMarketCount || 0}`)

console.log('\n' + '='.repeat(100))
console.log('\n✅ Sample data complete!\n')
