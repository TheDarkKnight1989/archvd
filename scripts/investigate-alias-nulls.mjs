/**
 * Investigate Alias NULL prices in V4 market data
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('================================================================================')
  console.log('ALIAS NULL PRICES INVESTIGATION')
  console.log('================================================================================\n')

  // STEP 1: Find a catalog with data
  console.log('=== STEP 1: Find catalogs with market data ===\n')

  // First, get some alias variants to find catalogs
  const { data: variants, error: varErr } = await supabase
    .from('inventory_v4_alias_variants')
    .select('alias_variant_id, alias_catalog_id, size_value')
    .limit(500)

  if (varErr || !variants?.length) {
    console.error('Error fetching variants:', varErr)
    return
  }

  console.log(`Found ${variants.length} variants`)

  // Get unique catalog IDs
  const catalogIds = [...new Set(variants.map(v => v.alias_catalog_id))]
  console.log(`Found ${catalogIds.length} unique catalogs`)

  // Build variant map
  const variantMap = {}
  for (const v of variants) {
    variantMap[v.alias_variant_id] = v
  }

  // Get market data for these variants
  const variantIds = variants.map(v => v.alias_variant_id)
  const { data: marketData, error: mdErr } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, highest_bid, region_id, consigned')
    .in('alias_variant_id', variantIds)

  if (mdErr || !marketData?.length) {
    console.error('Error fetching market data:', mdErr)
    return
  }

  console.log(`Found ${marketData.length} market data rows`)

  // Count nulls per catalog
  const catalogNulls = {}
  for (const m of marketData) {
    const variant = variantMap[m.alias_variant_id]
    if (!variant) continue
    const catalogId = variant.alias_catalog_id

    if (!catalogNulls[catalogId]) {
      catalogNulls[catalogId] = { total: 0, nullLowestAsk: 0, nullHighestBid: 0, bothNull: 0, hasAnyPrice: 0 }
    }
    catalogNulls[catalogId].total++
    if (m.lowest_ask === null) catalogNulls[catalogId].nullLowestAsk++
    if (m.highest_bid === null) catalogNulls[catalogId].nullHighestBid++
    if (m.lowest_ask === null && m.highest_bid === null) catalogNulls[catalogId].bothNull++
    if (m.lowest_ask !== null || m.highest_bid !== null) catalogNulls[catalogId].hasAnyPrice++
  }

  // Sort by total data (find one with good amount of data)
  const sortedCatalogs = Object.entries(catalogNulls)
    .map(([id, stats]) => ({
      catalogId: id,
      ...stats,
      nullRate: stats.total > 0 ? ((stats.bothNull) / stats.total * 100).toFixed(1) : '0'
    }))
    .filter(c => c.total >= 5)  // At least 5 rows
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  console.log('\nTop 10 catalogs by data volume:')
  console.table(sortedCatalogs)

  // Pick one with some nulls and some non-nulls
  const targetCatalog = sortedCatalogs.find(c => c.hasAnyPrice > 0) || sortedCatalogs[0]

  if (!targetCatalog) {
    console.log('No suitable catalogs found')
    return
  }

  console.log(`\n>>> Selected catalog: ${targetCatalog.catalogId}`)

  // Get the product info
  const { data: product } = await supabase
    .from('inventory_v4_alias_products')
    .select('sku, name, brand')
    .eq('alias_catalog_id', targetCatalog.catalogId)
    .single()

  if (product) {
    console.log(`>>> SKU: ${product.sku}`)
    console.log(`>>> Name: ${product.brand} ${product.name}`)
  }

  // STEP 2: Analyze NULL patterns for this catalog
  console.log('\n=== STEP 2: Analyze NULL patterns ===\n')

  // Get all variants for this catalog
  const { data: catalogVariants } = await supabase
    .from('inventory_v4_alias_variants')
    .select('alias_variant_id, size_value')
    .eq('alias_catalog_id', targetCatalog.catalogId)

  const catalogVariantIds = (catalogVariants || []).map(v => v.alias_variant_id)
  const catalogVariantMap = {}
  for (const v of catalogVariants || []) {
    catalogVariantMap[v.alias_variant_id] = v
  }

  // Get market data for this catalog
  const { data: catalogMarketData } = await supabase
    .from('inventory_v4_alias_market_data')
    .select('alias_variant_id, lowest_ask, highest_bid, region_id, consigned')
    .in('alias_variant_id', catalogVariantIds)

  // Group by region_id
  const byRegion = {}
  for (const row of catalogMarketData || []) {
    const region = row.region_id || 'null'
    if (!byRegion[region]) {
      byRegion[region] = { total: 0, hasLowestAsk: 0, hasHighestBid: 0, bothNull: 0 }
    }
    byRegion[region].total++
    if (row.lowest_ask !== null) byRegion[region].hasLowestAsk++
    if (row.highest_bid !== null) byRegion[region].hasHighestBid++
    if (row.lowest_ask === null && row.highest_bid === null) byRegion[region].bothNull++
  }
  console.log('By Region:')
  console.table(byRegion)

  // Group by consigned
  const byConsigned = {}
  for (const row of catalogMarketData || []) {
    const consigned = String(row.consigned)
    if (!byConsigned[consigned]) {
      byConsigned[consigned] = { total: 0, hasLowestAsk: 0, hasHighestBid: 0, bothNull: 0 }
    }
    byConsigned[consigned].total++
    if (row.lowest_ask !== null) byConsigned[consigned].hasLowestAsk++
    if (row.highest_bid !== null) byConsigned[consigned].hasHighestBid++
    if (row.lowest_ask === null && row.highest_bid === null) byConsigned[consigned].bothNull++
  }
  console.log('\nBy Consigned:')
  console.table(byConsigned)

  // STEP 3: Show sample rows
  console.log('\n=== STEP 3: Sample rows ===\n')

  const simplified = (catalogMarketData || []).slice(0, 20).map(r => ({
    size: catalogVariantMap[r.alias_variant_id]?.size_value,
    region: r.region_id,
    consigned: r.consigned,
    lowest_ask: r.lowest_ask,
    highest_bid: r.highest_bid,
  }))
  console.table(simplified)

  console.log('\n================================================================================')
  console.log('SUMMARY')
  console.log('================================================================================')
  console.log(`Catalog ID: ${targetCatalog.catalogId}`)
  console.log(`SKU: ${product?.sku || 'Unknown'}`)
  console.log(`Total market data rows: ${targetCatalog.total}`)
  console.log(`Rows with BOTH NULL: ${targetCatalog.bothNull}`)
  console.log(`Rows with ANY price: ${targetCatalog.hasAnyPrice}`)
  console.log('')
}

main().catch(console.error)
