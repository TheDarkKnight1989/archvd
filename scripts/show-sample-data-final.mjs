import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('\n📊 SAMPLE PRODUCT & SIZE-LEVEL DATA\n')
console.log('='.repeat(100))

// Get 3 Alias products
const { data: aliasProducts } = await supabase
  .from('inventory_v4_alias_products')
  .select('alias_catalog_id, sku, brand, name')
  .limit(3)

console.log('\n📦 ALIAS PRODUCTS (Multi-Region Pricing)\n')

if (aliasProducts && aliasProducts.length > 0) {
  for (const product of aliasProducts) {
    console.log(`\n${product.brand} - ${product.name}`)
    console.log(`  SKU: ${product.sku}`)
    console.log(`  Catalog ID: ${product.alias_catalog_id}`)

    // Get variant count per region
    const { data: regionCounts } = await supabase
      .rpc('exec', {
        sql: `SELECT region, COUNT(*) as count
              FROM inventory_v4_alias_variants
              WHERE alias_catalog_id = '${product.alias_catalog_id}'
              GROUP BY region`
      })

    // Get sample variants from each region
    const { data: variants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('alias_variant_id, size, region')
      .eq('alias_catalog_id', product.alias_catalog_id)
      .limit(6)

    if (variants && variants.length > 0) {
      // Group by region
      const byRegion = {}
      variants.forEach(v => {
        if (!byRegion[v.region]) byRegion[v.region] = []
        byRegion[v.region].push(v)
      })

      console.log(`\n  Sample sizes with live market data:`)

      for (const [region, regionVariants] of Object.entries(byRegion).slice(0, 2)) {
        console.log(`\n    ${region.toUpperCase()} Region:`)
        for (const variant of regionVariants.slice(0, 2)) {
          const { data: market } = await supabase
            .from('inventory_v4_alias_market_data')
            .select('lowest_ask_cents, highest_bid_cents, currency')
            .eq('alias_variant_id', variant.alias_variant_id)
            .limit(1)
            .maybeSingle()

          if (market) {
            const ask = (market.lowest_ask_cents / 100).toFixed(2)
            const bid = (market.highest_bid_cents / 100).toFixed(2)
            console.log(`      Size ${variant.size}: ${market.currency} ${ask} (ask) / ${bid} (bid)`)
          }
        }
      }
    }
  }
}

console.log('\n' + '='.repeat(100))
console.log('\n📦 STOCKX PRODUCTS (Single Currency)\n')

// Get 2 StockX products
const { data: stockxProducts } = await supabase
  .from('inventory_v4_stockx_products')
  .select('stockx_product_id, style_id, brand, title')
  .limit(2)

if (stockxProducts && stockxProducts.length > 0) {
  for (const product of stockxProducts) {
    console.log(`\n${product.brand} - ${product.title}`)
    console.log(`  SKU: ${product.style_id}`)

    // Get sample variants
    const { data: variants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id, size_display, currency')
      .eq('stockx_product_id', product.stockx_product_id)
      .limit(5)

    if (variants && variants.length > 0) {
      console.log(`\n  Sample sizes with live market data:`)

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
          console.log(`    Size ${variant.size_display}: ${variant.currency} ${ask} (ask) / ${bid} (bid)`)
        }
      }
    }
  }
}

console.log('\n' + '='.repeat(100))
console.log('\n📊 DATABASE TOTALS')
console.log('='.repeat(100))

const stats = await Promise.all([
  supabase.from('inventory_v4_alias_products').select('*', { count: 'exact', head: true }),
  supabase.from('inventory_v4_alias_variants').select('*', { count: 'exact', head: true }),
  supabase.from('inventory_v4_alias_market_data').select('*', { count: 'exact', head: true }),
  supabase.from('inventory_v4_stockx_products').select('*', { count: 'exact', head: true }),
  supabase.from('inventory_v4_stockx_variants').select('*', { count: 'exact', head: true }),
  supabase.from('inventory_v4_stockx_market_data').select('*', { count: 'exact', head: true }),
])

console.log(`\nAlias (Multi-Region):`)
console.log(`  ${stats[0].count || 0} products`)
console.log(`  ${stats[1].count || 0} size variants (across UK/EU/US)`)
console.log(`  ${stats[2].count || 0} market data records`)
console.log(`  ~${Math.round((stats[1].count || 0) / (stats[0].count || 1))} sizes per product average`)

console.log(`\nStockX (GBP Only):`)
console.log(`  ${stats[3].count || 0} products`)
console.log(`  ${stats[4].count || 0} size variants`)
console.log(`  ${stats[5].count || 0} market data records`)
console.log(`  ~${Math.round((stats[4].count || 0) / (stats[3].count || 1))} sizes per product average`)

console.log('\n' + '='.repeat(100))
console.log('\n✅ Complete!\n')
