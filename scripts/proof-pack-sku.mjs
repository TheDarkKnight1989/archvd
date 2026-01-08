/**
 * Proof Pack - Verify V4 data exists for a SKU
 *
 * Queries:
 * - inventory_v4_style_catalog (style_id lookup)
 * - inventory_v4_stockx_variants + inventory_v4_stockx_market_data (via variant IDs)
 * - inventory_v4_alias_variants + inventory_v4_alias_market_data (via variant IDs)
 * - inventory_v4_alias_sales_history (raw sales)
 * - inventory_v4_alias_sales_daily (daily aggregates)
 * - inventory_v4_alias_sales_monthly (monthly aggregates)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sku = process.argv[2] || 'FV5029-010'

async function main() {
  console.log('=== PROOF PACK FOR SKU:', sku, '===')
  console.log('')

  // 1. Find style_catalog entry
  const { data: style } = await supabase
    .from('inventory_v4_style_catalog')
    .select('*')
    .eq('style_id', sku)
    .single()

  if (!style) {
    console.log('❌ SKU not found in style_catalog')
    return
  }

  console.log('1. STYLE CATALOG:')
  console.log('   style_id:', style.style_id)
  console.log('   stockx_product_id:', style.stockx_product_id || 'N/A')
  console.log('   alias_catalog_id:', style.alias_catalog_id || 'N/A')
  console.log('')

  // 2. StockX market data (via variant IDs)
  let stockxMarketCount = 0
  if (style.stockx_product_id) {
    // Get variant IDs first
    const { data: stockxVariants } = await supabase
      .from('inventory_v4_stockx_variants')
      .select('stockx_variant_id')
      .eq('stockx_product_id', style.stockx_product_id)

    const variantIds = stockxVariants?.map(v => v.stockx_variant_id) || []
    console.log('2. STOCKX VARIANTS:', variantIds.length, 'variants')

    if (variantIds.length > 0) {
      const { count } = await supabase
        .from('inventory_v4_stockx_market_data')
        .select('*', { count: 'exact', head: true })
        .in('stockx_variant_id', variantIds)
      stockxMarketCount = count || 0

      console.log('   MARKET DATA:', stockxMarketCount, 'rows')

      if (stockxMarketCount > 0) {
        const { data: sample } = await supabase
          .from('inventory_v4_stockx_market_data')
          .select('stockx_variant_id, currency_code, lowest_ask, highest_bid, updated_at')
          .in('stockx_variant_id', variantIds)
          .limit(5)
        sample?.forEach(r => {
          console.log('     ', r.currency_code, '| ask:', r.lowest_ask, '| bid:', r.highest_bid)
        })
      }
    }
  } else {
    console.log('2. STOCKX: Not linked')
  }
  console.log('')

  // 3. Alias market data (via variant IDs)
  let aliasMarketCount = 0
  if (style.alias_catalog_id) {
    // Get variant IDs first
    const { data: aliasVariants } = await supabase
      .from('inventory_v4_alias_variants')
      .select('id')
      .eq('alias_catalog_id', style.alias_catalog_id)

    const variantIds = aliasVariants?.map(v => v.id) || []
    console.log('3. ALIAS VARIANTS:', variantIds.length, 'variants')

    if (variantIds.length > 0) {
      const { count } = await supabase
        .from('inventory_v4_alias_market_data')
        .select('*', { count: 'exact', head: true })
        .in('alias_variant_id', variantIds)
      aliasMarketCount = count || 0

      console.log('   MARKET DATA:', aliasMarketCount, 'rows')

      if (aliasMarketCount > 0) {
        const { data: sample } = await supabase
          .from('inventory_v4_alias_market_data')
          .select('alias_variant_id, currency_code, lowest_ask, highest_bid, last_sale_price, updated_at')
          .in('alias_variant_id', variantIds)
          .limit(5)
        sample?.forEach(r => {
          console.log('     ', r.currency_code, '| ask:', r.lowest_ask, '| bid:', r.highest_bid, '| last:', r.last_sale_price)
        })
      }
    }
  } else {
    console.log('3. ALIAS: Not linked')
  }
  console.log('')

  // 4. Raw sales (90d)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { count: rawSales } = await supabase
    .from('inventory_v4_alias_sales_history')
    .select('*', { count: 'exact', head: true })
    .eq('alias_catalog_id', style.alias_catalog_id)
    .gte('purchased_at', ninetyDaysAgo)

  console.log('4. RAW SALES (last 90 days):', rawSales || 0, 'rows')
  console.log('')

  // 5. Daily aggregates
  const { count: dailySales } = await supabase
    .from('inventory_v4_alias_sales_daily')
    .select('*', { count: 'exact', head: true })
    .eq('alias_catalog_id', style.alias_catalog_id)

  const { data: dailyMin } = await supabase
    .from('inventory_v4_alias_sales_daily')
    .select('sale_date')
    .eq('alias_catalog_id', style.alias_catalog_id)
    .order('sale_date', { ascending: true })
    .limit(1)

  const { data: dailyMax } = await supabase
    .from('inventory_v4_alias_sales_daily')
    .select('sale_date')
    .eq('alias_catalog_id', style.alias_catalog_id)
    .order('sale_date', { ascending: false })
    .limit(1)

  console.log('5. DAILY AGGREGATES:', dailySales || 0, 'rows')
  if (dailyMin?.[0] && dailyMax?.[0]) {
    console.log('   date range:', dailyMin[0].sale_date, '→', dailyMax[0].sale_date)
  }
  console.log('')

  // 6. Monthly aggregates
  const { count: monthlySales } = await supabase
    .from('inventory_v4_alias_sales_monthly')
    .select('*', { count: 'exact', head: true })
    .eq('alias_catalog_id', style.alias_catalog_id)

  const { data: monthlyMin } = await supabase
    .from('inventory_v4_alias_sales_monthly')
    .select('sale_month')
    .eq('alias_catalog_id', style.alias_catalog_id)
    .order('sale_month', { ascending: true })
    .limit(1)

  const { data: monthlyMax } = await supabase
    .from('inventory_v4_alias_sales_monthly')
    .select('sale_month')
    .eq('alias_catalog_id', style.alias_catalog_id)
    .order('sale_month', { ascending: false })
    .limit(1)

  console.log('6. MONTHLY AGGREGATES:', monthlySales || 0, 'rows')
  if (monthlyMin?.[0] && monthlyMax?.[0]) {
    console.log('   month range:', monthlyMin[0].sale_month, '→', monthlyMax[0].sale_month)
  }
  console.log('')

  // Summary
  console.log('=== SUMMARY ===')
  console.log('StockX market:', stockxMarketCount > 0 ? '✅' : '❌')
  console.log('Alias market:', aliasMarketCount > 0 ? '✅' : '❌')
  console.log('Raw sales (90d):', (rawSales || 0) > 0 ? '✅' : '❌')
  console.log('Daily aggregates:', (dailySales || 0) > 0 ? '✅' : '❌')
  console.log('Monthly aggregates:', (monthlySales || 0) > 0 ? '✅' : '❌')
}

main()
