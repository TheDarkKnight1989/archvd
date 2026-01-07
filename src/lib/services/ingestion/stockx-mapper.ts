/**
 * StockX Ingestion Mapper
 * Transforms raw StockX API snapshots → master_market_data table rows
 *
 * KEY ARCHITECTURAL NOTES:
 * - StockX prices are in MAJOR UNITS (e.g., "145.00" = $145.00)
 * - MUST convert to cents for database (multiply by 100)
 * - One market-data response contains multiple variants (sizes)
 * - Each variant becomes one master_market_data row
 * - Gender-based size filtering applied (3.5-16 for sneakers)
 */

import { createClient } from '@supabase/supabase-js'
import { isValidSize } from './size-validation'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * StockX V2 Market Data Response Shape
 * From: GET /v2/catalog/products/{productId}/market-data
 */
interface StockXMarketDataVariant {
  variantId: string
  size?: string
  variantValue?: string
  lowestAskAmount?: number | string  // Can be number or string "145.00"
  highestBidAmount?: number | string
  lastSaleAmount?: number | string
  salesLast72Hours?: number
  totalVolume?: number  // sales30Days
  averagePrice?: number
  volatility?: number  // 0.12 = 12%
  pricePremium?: number  // 0.35 = 35% above retail
  // Nested market data objects (new API format)
  standardMarketData?: {
    lowestAsk?: string
    highestBidAmount?: string
    sellFaster?: string
    earnMore?: string
  }
  flexMarketData?: {
    lowestAsk?: string | null
    highestBidAmount?: string
    sellFaster?: string
    earnMore?: string
  }
  directMarketData?: {
    lowestAsk?: string | null
    highestBidAmount?: string
    sellFaster?: string
    earnMore?: string
  }
  // Legacy flex fields (deprecated, kept for backward compatibility)
  flexLowestAskAmount?: number | string
  flexHighestBidAmount?: number | string
}

interface IngestionOptions {
  currencyCode: string
  productId: string
  styleId?: string
  sku?: string
  regionCode?: string
  snapshotAt?: Date
  category?: string  // For size validation
  gender?: string    // For size validation
}

// ============================================================================
// INGESTION FUNCTION
// ============================================================================

/**
 * Transform StockX market-data response to master_market_data rows
 *
 * @param rawSnapshotId - UUID from stockx_raw_snapshots table
 * @param rawPayload - Complete StockX API response (array of variants)
 * @param options - Context for normalization
 */
export async function ingestStockXMarketData(
  rawSnapshotId: string,
  rawPayload: StockXMarketDataVariant[],
  options: IngestionOptions
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { currencyCode, productId, styleId, sku, regionCode, snapshotAt } = options

  // Validate raw payload
  if (!Array.isArray(rawPayload)) {
    console.error('[StockX Mapper] Invalid payload: expected array', rawPayload)
    return
  }

  if (rawPayload.length === 0) {
    console.log('[StockX Mapper] Empty variants array, skipping ingestion')
    return
  }

  // Fetch size mappings from stockx_variants table
  // Market-data API doesn't include size info, so we need to look it up
  const variantIds = rawPayload.map(v => v.variantId).filter(Boolean)
  const { data: variantMappings } = await supabase
    .from('stockx_variants')
    .select('stockx_variant_id, variant_value, size_display')
    .eq('stockx_product_id', productId)
    .in('stockx_variant_id', variantIds)

  // Create lookup map for fast access
  const sizeMap = new Map<string, { size: string; display: string }>()
  if (variantMappings) {
    for (const mapping of variantMappings) {
      sizeMap.set(mapping.stockx_variant_id, {
        size: mapping.variant_value || 'Unknown',
        display: mapping.size_display || mapping.variant_value || 'Unknown'
      })
    }
  }

  console.log('[StockX Mapper] Size mappings loaded:', {
    variantsInPayload: variantIds.length,
    mappingsFound: sizeMap.size
  })

  const rows: any[] = []

  for (const variant of rawPayload) {
    // Skip variants without required fields
    if (!variant.variantId) {
      console.warn('[StockX Mapper] Skipping variant without variantId:', variant)
      continue
    }

    // Parse size key and numeric
    // Look up size from stockx_variants table (market-data API doesn't include size)
    const sizeInfo = sizeMap.get(variant.variantId)
    const sizeKey = sizeInfo?.size || variant.variantValue || variant.size || 'Unknown'
    const sizeNumeric = parseSizeNumeric(sizeKey)

    // Apply gender-based size filtering (skip invalid sizes)
    if (sizeNumeric && options.category) {
      if (!isValidSize(sizeNumeric, options.category, options.gender)) {
        console.log(`[StockX Mapper] Filtered out invalid size ${sizeKey} for ${options.gender || 'unisex'} ${options.category}`)
        continue  // Skip this variant
      }
    }

    // Base row data (shared by standard and flex)
    const baseRow = {
      // Provider identification
      provider: 'stockx',
      provider_source: 'stockx_market_data',
      provider_product_id: productId,
      provider_variant_id: variant.variantId,

      // Normalized identifiers
      sku: sku || styleId || null,
      size_key: sizeKey,
      size_numeric: sizeNumeric,
      size_system: 'US', // StockX defaults to US sizes

      // Currency context
      currency_code: currencyCode,
      region_code: regionCode || null,

      // Volume indicators
      // NOTE: StockX V2 market-data API doesn't provide these fields
      // They exist in /stats endpoint but that requires premium tier (403 Forbidden)
      // Kept as NULL for future compatibility if we upgrade API access
      sales_last_72h: null, // variant.salesLast72Hours - field doesn't exist in V2 API
      sales_last_30d: null, // variant.totalVolume - field doesn't exist in V2 API
      total_sales_volume: null, // variant.totalVolume - field doesn't exist in V2 API

      // StockX-specific analytics fields
      // NOTE: These also don't exist in V2 market-data API response
      // Requires premium tier or different endpoint (/stats returns 403)
      // Kept as NULL for future compatibility
      average_deadstock_price: null, // variant.averagePrice - field doesn't exist in V2 API
      volatility: null, // variant.volatility - field doesn't exist in V2 API
      price_premium: null, // variant.pricePremium - field doesn't exist in V2 API

      // Metadata
      snapshot_at: snapshotAt || new Date(),
      ingested_at: new Date(),
      raw_snapshot_id: rawSnapshotId,
      raw_snapshot_provider: 'stockx',
    }

    // Parse standard prices
    const lowestAsk = parsePrice(variant.lowestAskAmount)
    const highestBid = parsePrice(variant.highestBidAmount)
    const lastSalePrice = parsePrice(variant.lastSaleAmount)

    // Parse pricing suggestions (from standardMarketData)
    const sellFasterPrice = parsePrice(variant.standardMarketData?.sellFaster || variant.sellFasterAmount)
    const earnMorePrice = parsePrice(variant.standardMarketData?.earnMore || variant.earnMoreAmount)
    const beatUSPrice = parsePrice(variant.standardMarketData?.beatUS)

    // Standard pricing row
    rows.push({
      ...baseRow,
      lowest_ask: lowestAsk,
      highest_bid: highestBid,
      last_sale_price: lastSalePrice,
      sell_faster_price: sellFasterPrice,
      earn_more_price: earnMorePrice,
      beat_us_price: beatUSPrice,
      is_flex: false,
      is_consigned: false,
      raw_response_excerpt: {
        variantId: variant.variantId,
        size: variant.size || variant.variantValue,
        lowestAskAmount: variant.lowestAskAmount,
        highestBidAmount: variant.highestBidAmount,
        salesLast72Hours: variant.salesLast72Hours,
      },
    })

    // Flex pricing row (if flex data exists)
    // Check for Flex availability using flexMarketData object
    // Flex exists if lowestAsk is not null OR if sellFaster/earnMore are present
    if (variant.flexMarketData && (variant.flexMarketData.lowestAsk || variant.flexMarketData.sellFaster || variant.flexMarketData.earnMore)) {
      // Flex lowestAsk is either from flexMarketData.lowestAsk or falls back to standard lowestAskAmount
      const flexLowestAsk = parsePrice(variant.flexMarketData.lowestAsk || variant.lowestAskAmount)
      const flexHighestBid = parsePrice(variant.flexMarketData.highestBidAmount || variant.highestBidAmount)

      // Flex-specific pricing suggestions
      const flexSellFasterPrice = parsePrice(variant.flexMarketData.sellFaster)
      const flexEarnMorePrice = parsePrice(variant.flexMarketData.earnMore)
      const flexBeatUSPrice = parsePrice(variant.flexMarketData.beatUS)

      rows.push({
        ...baseRow,
        provider_source: 'stockx_market_data_flex', // Different source to avoid deduplication collision
        lowest_ask: flexLowestAsk,
        highest_bid: flexHighestBid,
        last_sale_price: lastSalePrice, // Same as standard
        sell_faster_price: flexSellFasterPrice,
        earn_more_price: flexEarnMorePrice,
        beat_us_price: flexBeatUSPrice,
        is_flex: true,
        is_consigned: false,
        raw_response_excerpt: {
          variantId: variant.variantId,
          size: variant.size || variant.variantValue,
          flexMarketData: variant.flexMarketData,
          salesLast72Hours: variant.salesLast72Hours,
        },
      })
    }

    // Direct/Consignment pricing row (if direct data exists)
    // Check for Direct availability using directMarketData object
    // Direct exists if lowestAsk is not null OR if sellFaster/earnMore are present
    if (variant.directMarketData && (variant.directMarketData.lowestAsk || variant.directMarketData.sellFaster || variant.directMarketData.earnMore)) {
      // Direct lowestAsk is either from directMarketData.lowestAsk or falls back to standard lowestAskAmount
      const directLowestAsk = parsePrice(variant.directMarketData.lowestAsk || variant.lowestAskAmount)
      const directHighestBid = parsePrice(variant.directMarketData.highestBidAmount || variant.highestBidAmount)

      // Direct-specific pricing suggestions
      const directSellFasterPrice = parsePrice(variant.directMarketData.sellFaster)
      const directEarnMorePrice = parsePrice(variant.directMarketData.earnMore)
      const directBeatUSPrice = parsePrice(variant.directMarketData.beatUS)

      rows.push({
        ...baseRow,
        provider_source: 'stockx_market_data_direct', // Different source to avoid deduplication collision
        lowest_ask: directLowestAsk,
        highest_bid: directHighestBid,
        last_sale_price: lastSalePrice, // Same as standard
        sell_faster_price: directSellFasterPrice,
        earn_more_price: directEarnMorePrice,
        beat_us_price: directBeatUSPrice,
        is_flex: false,
        is_consigned: true,
        raw_response_excerpt: {
          variantId: variant.variantId,
          size: variant.size || variant.variantValue,
          directMarketData: variant.directMarketData,
          salesLast72Hours: variant.salesLast72Hours,
        },
      })
    }
  }

  // Deduplicate rows before inserting (use unique key to identify duplicates)
  // NOTE: snapshot_at is NOT included in deduplication key to avoid creating duplicates
  // when syncing UK, EU, US sequentially (each has different timestamp)
  const uniqueRows = new Map<string, any>()
  for (const row of rows) {
    const key = `${row.provider}|${row.provider_source}|${row.provider_product_id}|${row.provider_variant_id}|${row.size_key}|${row.currency_code}|${row.region_code}`
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, row)
    }
  }
  const deduplicatedRows = Array.from(uniqueRows.values())

  console.log('[StockX Mapper] Deduplication:', {
    original: rows.length,
    deduplicated: deduplicatedRows.length,
    duplicatesRemoved: rows.length - deduplicatedRows.length
  })

  // Batch upsert into master_market_data (handles duplicates gracefully)
  const { error } = await supabase.from('master_market_data').upsert(deduplicatedRows)

  if (error) {
    // CRITICAL: Must throw on database errors so caller knows ingestion failed
    console.error('[StockX Mapper] Failed to ingest market data:', {
      error,
      rawSnapshotId,
      productId,
      variantCount: rows.length,
    })
    throw new Error(`Database upsert failed: ${error.message || JSON.stringify(error)}`)
  }

  console.log('[StockX Mapper] Successfully ingested:', {
    rawSnapshotId,
    productId,
    variantCount: rows.length,
    currencyCode,
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse price from StockX response
 * StockX returns prices as NUMBERS or STRINGS in MAJOR UNITS (dollars)
 * Example: 145.00 or "145.00" → $145.00
 *
 * ⚠️ MUST CONVERT TO CENTS - database stores integer cents!
 * Example: "74.00" → 7400 cents (not 74)
 */
function parsePrice(value: number | string | undefined | null): number | null {
  if (value === null || value === undefined) {
    return null
  }

  let price: number

  if (typeof value === 'number') {
    price = value
  } else if (typeof value === 'string') {
    price = parseFloat(value)
    if (isNaN(price)) {
      return null
    }
  } else {
    return null
  }

  // Convert dollars to cents (StockX returns $74.00, we store 7400 cents)
  return Math.round(price * 100)
}

/**
 * Extract numeric size from size string
 * Examples:
 *   "10.5" → 10.5
 *   "UK 9" → 9.0
 *   "M" → null
 */
function parseSizeNumeric(sizeKey: string): number | null {
  // Remove non-numeric characters except decimal point
  const cleaned = sizeKey.replace(/[^0-9.]/g, '')

  if (!cleaned) {
    return null
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}
