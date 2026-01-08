import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const skus = ['BY1604', 'B75571']

  for (const sku of skus) {
    console.log('\n' + '='.repeat(60))
    console.log('SKU:', sku)
    console.log('='.repeat(60))

    // Check style catalog
    const { data: style } = await supabase
      .from('inventory_v4_style_catalog')
      .select('*')
      .eq('style_id', sku)
      .single()

    console.log('\n📚 Style Catalog:')
    console.log('  Brand:', style?.brand || '❌ Missing')
    console.log('  Name:', style?.name || '❌ Missing')
    console.log('  StockX URL Key:', style?.stockx_url_key || '❌ Missing')
    console.log('  Alias Catalog ID:', style?.alias_catalog_id || '❌ Missing')

    // Check StockX product
    const { data: stockxProduct } = await supabase
      .from('inventory_v4_stockx_products')
      .select('*')
      .eq('style_id', sku)
      .maybeSingle()

    console.log('\n🟢 StockX Product:')
    if (stockxProduct) {
      console.log('  ✅ Found')
      console.log('  Title:', stockxProduct.title)
      console.log('  Brand:', stockxProduct.brand)
    } else {
      console.log('  ❌ NOT FOUND')
    }

    // Check StockX variants
    const { data: stockxVariants, count: stockxCount } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('*', { count: 'exact' })
      .eq('style_id', sku)
      .limit(3)

    console.log('\n🟢 StockX Variants:', stockxCount || 0)
    if (stockxVariants && stockxVariants.length > 0) {
      stockxVariants.slice(0, 3).forEach(v => {
        console.log('  Size', v.size, '- Lowest Ask:', v.lowest_ask, '| Highest Bid:', v.highest_bid)
      })
    }

    // Check Alias product
    const { data: aliasProduct } = await supabase
      .from('inventory_v4_alias_products')
      .select('*')
      .eq('alias_catalog_id', style?.alias_catalog_id)
      .maybeSingle()

    console.log('\n🔵 Alias Product:')
    if (aliasProduct) {
      console.log('  ✅ Found')
      console.log('  Name:', aliasProduct.name)
      console.log('  Brand:', aliasProduct.brand)
    } else {
      console.log('  ❌ NOT FOUND')
    }

    // Check Alias variants
    const { data: aliasVariants, count: aliasCount } = await supabase
      .from('inventory_v4_alias_variants')
      .select('*', { count: 'exact' })
      .eq('alias_catalog_id', style?.alias_catalog_id)
      .limit(3)

    console.log('\n🔵 Alias Variants:', aliasCount || 0)
    if (aliasVariants && aliasVariants.length > 0) {
      aliasVariants.slice(0, 3).forEach(v => {
        console.log('  Size', v.size_us, '- Lowest Ask:', v.lowest_price_cents ? (v.lowest_price_cents/100).toFixed(0) : 'N/A')
      })
    }
  }
}

check()
