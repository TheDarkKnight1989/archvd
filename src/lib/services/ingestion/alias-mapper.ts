/**
 * Alias Ingestion Mapper
 * Transforms raw Alias API snapshots → master_market_data table rows
 *
 * KEY ARCHITECTURAL NOTES:
 * - Alias prices are in CENTS as STRINGS (e.g., "14500" = $145.00)
 * - MUST DIVIDE BY 100 before storing in master_market_data
 * - Alias doesn't provide sales volume in availabilities endpoint
 * - Need separate recent_sales endpoint for volume data (future)
 * - Filter to standard conditions: NEW + GOOD_CONDITION
 */

import { createClient } from '@supabase/supabase-js'
import { isValidSize } from './size-validation'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Alias Availability Response Shape
 * From: GET /api/v1/pricing_insights/availabilities/{catalogId}
 */
interface AliasVariantAvailability {
  size: number  // Numeric size (e.g., 10.5)
  size_unit: string  // 'US', 'UK', 'EU', etc.
  product_condition: string  // 'PRODUCT_CONDITION_NEW'
  packaging_condition: string  // 'PACKAGING_CONDITION_GOOD_CONDITION'
  availability: {
    lowest_listing_price_cents: string  // "14500" = $145.00
    highest_offer_price_cents: string  // "13000" = $130.00
    number_of_listings: number
    number_of_offers: number
  } | null
  consigned: boolean
}

interface AliasAvailabilitiesResponse {
  variants: AliasVariantAvailability[]
}

interface IngestionOptions {
  catalogId: string
  regionId?: string
  sku?: string
  category?: string  // Product category for size validation (e.g., 'sneakers', 'apparel')
  gender?: string    // Product gender for size validation (e.g., 'men', 'women', 'youth')
  snapshotAt?: Date
  includeConsigned?: boolean  // Whether to include consigned items (deprecated - use consignedFilter instead)
  consignedFilter?: boolean | 'mixed'  // true = consigned only, false = non-consigned only, 'mixed' = both
}

// Standard conditions to filter for
const STANDARD_CONDITIONS = {
  product_condition: 'PRODUCT_CONDITION_NEW',
  packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
}

/**
 * Map Alias region_id to region code
 *
 * IMPORTANT: Alias ALWAYS returns prices in USD cents, regardless of region!
 * The region_id indicates the MARKETPLACE (US/UK/EU), NOT the currency.
 *
 * Region IDs from Alias API:
 * - 1: US marketplace (prices in USD)
 * - 2: EU marketplace (prices in USD)
 * - 3: UK marketplace (prices in USD)
 *
 * All prices are in USD cents and should be stored as USD.
 */
function getRegionConfig(regionId?: string): { currencyCode: string; regionCode: string } {
  if (!regionId) {
    return { currencyCode: 'USD', regionCode: 'global' }
  }

  const regionMap: Record<string, { currencyCode: string; regionCode: string }> = {
    '1': { currencyCode: 'USD', regionCode: 'US' },
    '2': { currencyCode: 'USD', regionCode: 'EU' },
    '3': { currencyCode: 'USD', regionCode: 'UK' },
  }

  return regionMap[regionId] || { currencyCode: 'USD', regionCode: 'global' }
}

// ============================================================================
// INGESTION FUNCTION
// ============================================================================

/**
 * Transform Alias availabilities response to master_market_data rows
 *
 * @param rawSnapshotId - UUID from alias_raw_snapshots table (or null if not logged)
 * @param rawPayload - Complete Alias API response
 * @param options - Context for normalization
 */
export async function ingestAliasAvailabilities(
  rawSnapshotId: string | null,
  rawPayload: AliasAvailabilitiesResponse,
  options: IngestionOptions
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { catalogId, regionId, sku, category, gender, snapshotAt, consignedFilter } = options

  // Get currency and region code based on region_id
  const { currencyCode, regionCode } = getRegionConfig(regionId)

  // Validate raw payload
  if (!rawPayload || !Array.isArray(rawPayload.variants)) {
    console.error('[Alias Mapper] Invalid payload: expected variants array', rawPayload)
    return
  }

  if (rawPayload.variants.length === 0) {
    console.log('[Alias Mapper] Empty variants array, skipping ingestion')
    return
  }

  // Filter to standard conditions only
  const filteredVariants = rawPayload.variants.filter(
    (variant) =>
      variant.product_condition === STANDARD_CONDITIONS.product_condition &&
      variant.packaging_condition === STANDARD_CONDITIONS.packaging_condition
  )

  if (filteredVariants.length === 0) {
    console.log('[Alias Mapper] No standard condition variants found, skipping ingestion')
    return
  }

  // Determine which variants to process based on consignedFilter
  let variantsToProcess = filteredVariants
  if (consignedFilter === true) {
    // Only consigned variants
    variantsToProcess = filteredVariants.filter((v) => v.consigned === true)
  } else if (consignedFilter === false) {
    // Only non-consigned variants
    variantsToProcess = filteredVariants.filter((v) => v.consigned === false)
  }
  // else 'mixed' or undefined = all variants

  // Apply size validation filtering (category + gender)
  const beforeSizeFilter = variantsToProcess.length
  if (category) {
    variantsToProcess = variantsToProcess.filter((v) => isValidSize(v.size, category, gender))
    const filteredCount = beforeSizeFilter - variantsToProcess.length
    if (filteredCount > 0) {
      const genderLabel = gender ? ` | ${gender}` : ''
      console.log(`[Alias Mapper] Filtered out ${filteredCount} invalid sizes (category: ${category}${genderLabel})`)
    }
  }

  console.log('[Alias Mapper] Processing variants:', {
    total: filteredVariants.length,
    toProcess: variantsToProcess.length,
    consignedFilter,
  })

  // Determine provider_source based on consignedFilter
  const providerSource = consignedFilter === true
    ? 'alias_availabilities_consigned'
    : 'alias_availabilities'

  const rows = variantsToProcess
    .filter((variant) => {
      // Skip variants without availability data
      if (!variant.availability) {
        console.warn('[Alias Mapper] Skipping variant without availability:', variant)
        return false
      }
      return true
    })
    .map((variant) => {
      const availability = variant.availability!

      // Parse size
      const sizeKey = variant.size.toString()
      const sizeNumeric = variant.size

      // Parse prices - Alias returns CENTS as STRINGS, we store as INTEGER CENTS
      // Example: "50000" → 50000 (cents, stored in master_market_data)
      const lowestAsk = parsePriceCents(availability.lowest_listing_price_cents)
      const highestBid = parsePriceCents(availability.highest_offer_price_cents)

      // Build master_market_data row
      return {
        // Provider identification
        provider: 'alias',
        provider_source: providerSource,
        provider_product_id: catalogId,
        provider_variant_id: null,  // Alias doesn't have variant IDs

        // Normalized identifiers
        sku: sku || null,
        size_key: sizeKey,
        size_numeric: sizeNumeric,
        size_system: variant.size_unit || 'US',

        // Currency context
        currency_code: currencyCode,  // Dynamic based on region_id
        region_code: regionCode,  // Dynamic based on region_id

        // Pricing data (in MAJOR UNITS after conversion)
        lowest_ask: lowestAsk,
        highest_bid: highestBid,
        last_sale_price: parsePriceCents(availability.last_sold_listing_price_cents),  // From availabilities endpoint

        // Volume indicators (not available in availabilities endpoint)
        sales_last_72h: null,
        sales_last_30d: null,
        total_sales_volume: null,

        // Market depth
        ask_count: availability.number_of_listings ?? null,
        bid_count: availability.number_of_offers ?? null,

        // Alias-specific fields
        global_indicator_price: parsePriceCents(availability.global_indicator_price_cents),  // From availabilities endpoint

        // Flex/Consigned flags
        is_flex: false,  // Alias doesn't support Flex
        is_consigned: variant.consigned || consignedFilter === true,

        // Metadata
        snapshot_at: snapshotAt || new Date(),
        ingested_at: new Date(),
        raw_snapshot_id: rawSnapshotId,
        raw_snapshot_provider: 'alias',

        // Raw response excerpt (for debugging)
        raw_response_excerpt: {
          size: variant.size,
          size_unit: variant.size_unit,
          consigned: variant.consigned,
          lowest_listing_price_cents: availability.lowest_listing_price_cents,
          highest_offer_price_cents: availability.highest_offer_price_cents,
          number_of_listings: availability.number_of_listings,
          number_of_offers: availability.number_of_offers,
        },
      }
    })

  // Batch upsert into master_market_data (handles duplicates gracefully)
  const { error } = await supabase.from('master_market_data').upsert(rows)

  if (error) {
    // Don't throw - just log and continue
    console.error('[Alias Mapper] Failed to ingest market data:', {
      error,
      rawSnapshotId,
      catalogId,
      variantCount: rows.length,
    })
  } else {
    console.log('[Alias→Master][' + regionCode + '] inserted ' + rows.length + ' rows from availabilities')
    console.log('[Alias Mapper] Successfully ingested:', {
      rawSnapshotId,
      catalogId,
      variantCount: rows.length,
      regionCode,
      currencyCode,
    })
  }
}

// ============================================================================
// FUTURE: RECENT SALES INGESTION
// ============================================================================

/**
 * Transform Alias recent_sales response to update volume metrics in master_market_data
 *
 * This endpoint provides:
 * - List of recent sales with timestamps and prices
 * - Can be aggregated to calculate sales_last_72h, sales_last_30d
 * - Provides actual transaction data vs just listings/offers
 *
 * IMPORTANT: This function UPDATES existing rows, does NOT insert new ones
 *
 * @param rawSnapshotId - UUID from alias_raw_snapshots table (or null if not logged)
 * @param rawPayload - Complete Alias recent_sales API response
 * @param options - Context for normalization
 */
export async function ingestAliasRecentSales(
  rawSnapshotId: string | null,
  rawPayload: { recent_sales: Array<{
    purchased_at: string;
    price_cents: string;
    size: number;
    consigned: boolean;
    catalog_id: string;
  }> },
  options: IngestionOptions
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { catalogId, regionId, sku } = options

  // Get currency and region code based on region_id
  const { currencyCode, regionCode } = getRegionConfig(regionId)

  // Validate raw payload
  if (!rawPayload || !Array.isArray(rawPayload.recent_sales)) {
    console.error('[Alias Mapper] Invalid recent_sales payload: expected recent_sales array', rawPayload)
    return
  }

  if (rawPayload.recent_sales.length === 0) {
    console.log('[Alias Mapper] Empty recent_sales array, skipping volume update')
    return
  }

  const now = new Date()
  const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Group sales by size + consignment status
  type SizeKey = string
  type ConsignedKey = 'true' | 'false'
  const salesBySize = new Map<SizeKey, Map<ConsignedKey, typeof rawPayload.recent_sales>>()

  for (const sale of rawPayload.recent_sales) {
    const sizeKey = sale.size.toString()
    const consignedKey = sale.consigned ? 'true' : 'false'

    if (!salesBySize.has(sizeKey)) {
      salesBySize.set(sizeKey, new Map())
    }

    const consignedMap = salesBySize.get(sizeKey)!
    if (!consignedMap.has(consignedKey)) {
      consignedMap.set(consignedKey, [])
    }

    consignedMap.get(consignedKey)!.push(sale)
  }

  // Process each size + consignment combination
  const updates: Array<{
    sizeKey: string
    isConsigned: boolean
    sales72h: number
    sales30d: number
    lastSalePrice: number | null
    lastSaleAt: Date | null
    volume30d: number
  }> = []

  for (const [sizeKey, consignedMap] of salesBySize.entries()) {
    for (const [consignedKey, sales] of consignedMap.entries()) {
      const isConsigned = consignedKey === 'true'

      // Sort by purchased_at DESC (most recent first)
      const sortedSales = [...sales].sort((a, b) =>
        new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
      )

      // Calculate volume metrics
      const sales72h = sortedSales.filter(s => new Date(s.purchased_at) >= cutoff72h).length
      const sales30d = sortedSales.filter(s => new Date(s.purchased_at) >= cutoff30d).length

      // Get most recent sale
      const mostRecentSale = sortedSales[0]
      const lastSalePrice = parsePriceCents(mostRecentSale?.price_cents) // Converts cents → major units
      const lastSaleAt = mostRecentSale ? new Date(mostRecentSale.purchased_at) : null

      updates.push({
        sizeKey,
        isConsigned,
        sales72h,
        sales30d,
        lastSalePrice,
        lastSaleAt,
        volume30d: sales30d, // Alias uses count, not dollar volume
      })

      console.log('[Alias Mapper] Calculated volume for size:', {
        catalogId,
        sizeKey,
        isConsigned,
        sales72h,
        sales30d,
        lastSalePrice,
        lastSaleAt,
      })
    }
  }

  // Update existing rows in master_market_data
  let successCount = 0
  let errorCount = 0

  for (const update of updates) {
    const { error } = await supabase
      .from('master_market_data')
      .update({
        sales_last_72h: update.sales72h,
        sales_last_30d: update.sales30d,
        last_sale_price: update.lastSalePrice,
        // Note: last_sale_at not in schema, removed
        total_sales_volume: update.volume30d,
        ingested_at: new Date().toISOString(),
      })
      .eq('provider', 'alias')
      .eq('provider_product_id', catalogId)
      .eq('size_key', update.sizeKey)
      .eq('currency_code', currencyCode)
      .eq('region_code', regionCode)

    if (error) {
      console.error('[Alias Mapper] Failed to update volume data:', {
        error,
        catalogId,
        sizeKey: update.sizeKey,
        isConsigned: update.isConsigned,
      })
      errorCount++
    } else {
      successCount++
    }
  }

  console.log('[Alias→Master][' + regionCode + '] updated volume metrics for ' + successCount + ' rows from recent_sales')

  // ============================================================================
  // STEP 2: Insert individual sales into alias_recent_sales_detail for time-series
  // ============================================================================

  try {
    const salesDetailRows = rawPayload.recent_sales.map(sale => ({
      catalog_id: catalogId,
      sku: sku || null,
      size_value: sale.size,
      size_unit: 'US', // Alias uses US sizes
      price_cents: parseInt(sale.price_cents, 10),
      purchased_at: sale.purchased_at,
      consigned: sale.consigned,
      region_code: regionCode,
      currency_code: currencyCode,
      snapshot_at: options.snapshotAt || new Date(),
      raw_snapshot_id: rawSnapshotId,
    }))

    const { error: detailError } = await supabase
      .from('alias_recent_sales_detail')
      .insert(salesDetailRows)

    if (detailError) {
      console.error('[Alias Mapper] Failed to insert sales detail (non-fatal):', detailError.message)
    } else {
      console.log(`[Alias→Detail][${regionCode}] inserted ${salesDetailRows.length} individual sales to alias_recent_sales_detail`)
    }
  } catch (detailErr: any) {
    console.error('[Alias Mapper] Sales detail insert error (non-fatal):', detailErr.message)
  }

  console.log('[Alias Mapper] Recent sales volume update complete:', {
    rawSnapshotId,
    catalogId,
    regionCode,
    currencyCode,
    totalUpdates: updates.length,
    successCount,
    errorCount,
  })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse price from Alias API (CENTS as STRING → INTEGER CENTS)
 * Alias returns prices as cent strings, we store as integer cents in master_market_data
 *
 * Example: "50000" → 50000 (cents, equivalent to $500.00)
 *
 * ⚠️ CRITICAL: Do NOT divide by 100! master_market_data stores in cents.
 */
function parsePriceCents(value: string | undefined | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = parseInt(value, 10)

  if (isNaN(parsed)) {
    return null
  }

  // IMPORTANT: master_market_data stores prices in CENTS (smallest currency unit)
  // Alias API returns prices as cent strings: "50000" = 50000 cents = $500.00
  // We store the raw cent value WITHOUT division
  return parsed
}
