/**
 * Unified Market Data Service
 *
 * Provides combined market data from StockX and Alias via the style_catalog join.
 * Uses simple SQL functions - no materialized views, easy to debug and modify.
 *
 * Architecture:
 *   style_catalog (SKU) → stockx_products → stockx_variants → stockx_market_data
 *                       → alias_products  → alias_variants  → alias_market_data
 *
 * Join: Variants matched on size (TEXT↔NUMERIC normalized)
 *
 * IMPORTANT - Currency:
 *   - StockX returns prices in GBP (user's region)
 *   - Alias returns prices in USD (always)
 *   - This service returns NATIVE currencies - use `useCurrency` hook for FX conversion
 *     before comparing prices across providers.
 *
 * IMPORTANT - Region IDs:
 *   - Region mapping is still being confirmed with Alias
 *   - Current assumption based on testing: '1'=UK, '2'=EU, '3'=US
 *   - This may be inverted from Alias documentation
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Alias region ID type (API-level)
 * Use `getAliasRegion()` from '@/lib/utils/region' to convert from user-facing Region type.
 * NOTE: Region mapping still being confirmed - assume '1'=UK, '2'=EU, '3'=US
 */
export type AliasRegion = '1' | '2' | '3'

// Types for the unified market data response
export interface UnifiedMarketRow {
  // Size info
  size_display: string
  size_numeric: number | null

  // StockX data
  stockx_variant_id: string | null
  stockx_lowest_ask: number | null
  stockx_highest_bid: number | null
  stockx_flex_lowest_ask: number | null
  stockx_earn_more: number | null
  stockx_sell_faster: number | null
  stockx_currency: string | null
  stockx_updated_at: string | null

  // Alias data
  alias_variant_id: number | null
  alias_lowest_ask: number | null
  alias_highest_bid: number | null
  alias_last_sale: number | null
  alias_global_indicator: number | null
  alias_currency: string | null
  alias_updated_at: string | null

  // Provider flags
  has_stockx: boolean
  has_alias: boolean
}

export interface UnifiedMarketBatchRow {
  style_id: string
  size_display: string
  stockx_lowest_ask: number | null
  stockx_highest_bid: number | null
  stockx_currency: string | null
  alias_lowest_ask: number | null
  alias_highest_bid: number | null
  alias_currency: string | null
  has_stockx: boolean
  has_alias: boolean
}

export interface GetUnifiedMarketDataOptions {
  styleId: string
  aliasRegion?: AliasRegion
  consigned?: boolean
}

export interface GetUnifiedMarketDataBatchOptions {
  styleIds: string[]
  sizes: string[]
  aliasRegion?: AliasRegion
  consigned?: boolean
}

/**
 * Get unified market data for a single SKU (all sizes)
 *
 * @example
 * const data = await getUnifiedMarketData({
 *   styleId: 'DD1391-100',
 *   aliasRegion: '1', // UK
 * })
 */
export async function getUnifiedMarketData(
  supabase: ReturnType<typeof createClient>,
  options: GetUnifiedMarketDataOptions
): Promise<{ data: UnifiedMarketRow[] | null; error: Error | null }> {
  const { styleId, aliasRegion = '1', consigned = false } = options

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_unified_market_data', {
      p_style_id: styleId,
      p_alias_region: aliasRegion,
      p_consigned: consigned,
    })

    if (error) {
      console.error('[UnifiedMarket:single] RPC error:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as UnifiedMarketRow[], error: null }
  } catch (err) {
    console.error('[UnifiedMarket:single] Unexpected error:', err)
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Get unified market data for multiple SKUs + specific sizes
 * Optimized for inventory table queries
 *
 * @example
 * const data = await getUnifiedMarketDataBatch({
 *   styleIds: ['DD1391-100', 'DZ5485-612'],
 *   sizes: ['10', '10.5', '11'],
 *   aliasRegion: '1',
 * })
 */
export async function getUnifiedMarketDataBatch(
  supabase: ReturnType<typeof createClient>,
  options: GetUnifiedMarketDataBatchOptions
): Promise<{ data: UnifiedMarketBatchRow[] | null; error: Error | null }> {
  const { styleIds, sizes, aliasRegion = '1', consigned = false } = options

  if (styleIds.length === 0 || sizes.length === 0) {
    return { data: [], error: null }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_unified_market_data_batch', {
      p_style_ids: styleIds,
      p_sizes: sizes,
      p_alias_region: aliasRegion,
      p_consigned: consigned,
    })

    if (error) {
      console.error('[UnifiedMarket:batch] RPC error:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: data as UnifiedMarketBatchRow[], error: null }
  } catch (err) {
    console.error('[UnifiedMarket:batch] Unexpected error:', err)
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Dev fallback: mirrors RPC behaviour approximately; prefer RPC in prod.
 * Uses JS-side join logic - may drift from SQL function if not kept in sync.
 */
export async function getUnifiedMarketDataDirect(
  supabase: ReturnType<typeof createClient>,
  options: GetUnifiedMarketDataOptions
): Promise<{ data: UnifiedMarketRow[] | null; error: Error | null }> {
  const { styleId, aliasRegion = '1', consigned = false } = options

  try {
    // First get the style catalog entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: style, error: styleError } = await (supabase as any)
      .from('inventory_v4_style_catalog')
      .select('style_id, stockx_product_id, alias_catalog_id')
      .eq('style_id', styleId)
      .single() as { data: { style_id: string; stockx_product_id: string | null; alias_catalog_id: string | null } | null; error: Error | null }

    if (styleError || !style) {
      return { data: null, error: new Error(`Style not found: ${styleId}`) }
    }

    // Fetch StockX data
    const stockxData: Map<string, {
      stockx_variant_id: string
      variant_value: string
      lowest_ask: number | null
      highest_bid: number | null
      flex_lowest_ask: number | null
      earn_more: number | null
      sell_faster: number | null
      currency_code: string | null
      updated_at: string | null
    }> = new Map()

    if (style.stockx_product_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: variants } = await (supabase as any)
        .from('inventory_v4_stockx_variants')
        .select(`
          stockx_variant_id,
          variant_value,
          inventory_v4_stockx_market_data (
            lowest_ask,
            highest_bid,
            flex_lowest_ask,
            earn_more,
            sell_faster,
            currency_code,
            updated_at
          )
        `)
        .eq('stockx_product_id', style.stockx_product_id) as { data: Array<{
          stockx_variant_id: string
          variant_value: string
          inventory_v4_stockx_market_data: unknown[]
        }> | null }

      if (variants) {
        for (const v of variants) {
          const market = (v.inventory_v4_stockx_market_data)?.[0] as {
            lowest_ask: number | null
            highest_bid: number | null
            flex_lowest_ask: number | null
            earn_more: number | null
            sell_faster: number | null
            currency_code: string | null
            updated_at: string | null
          } | undefined

          stockxData.set(v.variant_value, {
            stockx_variant_id: v.stockx_variant_id,
            variant_value: v.variant_value,
            lowest_ask: market?.lowest_ask ?? null,
            highest_bid: market?.highest_bid ?? null,
            flex_lowest_ask: market?.flex_lowest_ask ?? null,
            earn_more: market?.earn_more ?? null,
            sell_faster: market?.sell_faster ?? null,
            currency_code: market?.currency_code ?? null,
            updated_at: market?.updated_at ?? null,
          })
        }
      }
    }

    // Fetch Alias data
    const aliasData: Map<string, {
      alias_variant_id: number
      size_display: string
      size_value: number
      lowest_ask: number | null
      highest_bid: number | null
      last_sale_price: number | null
      global_indicator_price: number | null
      currency_code: string | null
      updated_at: string | null
    }> = new Map()

    if (style.alias_catalog_id) {
      // Fetch variants first (no nested select - FK not defined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: variants } = await (supabase as any)
        .from('inventory_v4_alias_variants')
        .select('id, size_value, size_display')
        .eq('alias_catalog_id', style.alias_catalog_id)
        .eq('region_id', aliasRegion)
        .eq('consigned', consigned) as { data: Array<{
          id: number
          size_value: number
          size_display: string
        }> | null }

      if (variants && variants.length > 0) {
        // Fetch market data separately and join in JS
        const variantIds = variants.map((v) => v.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: marketRows } = await (supabase as any)
          .from('inventory_v4_alias_market_data')
          .select('alias_variant_id, lowest_ask, highest_bid, last_sale_price, global_indicator_price, currency_code, updated_at')
          .in('alias_variant_id', variantIds) as { data: Array<{
            alias_variant_id: number
            lowest_ask: number | null
            highest_bid: number | null
            last_sale_price: number | null
            global_indicator_price: number | null
            currency_code: string | null
            updated_at: string | null
          }> | null }

        // Build lookup map for market data
        const marketByVariant = new Map<number, {
          lowest_ask: number | null
          highest_bid: number | null
          last_sale_price: number | null
          global_indicator_price: number | null
          currency_code: string | null
          updated_at: string | null
        }>()
        if (marketRows) {
          for (const m of marketRows) {
            marketByVariant.set(m.alias_variant_id, m)
          }
        }

        for (const v of variants) {
          const market = marketByVariant.get(v.id)

          // Filter: Only include variants with at least ONE actionable price
          // This excludes infant/toddler sizes with no market activity
          const hasAsk = market?.lowest_ask != null
          const hasBid = market?.highest_bid != null
          const hasLastSale = market?.last_sale_price != null

          if (!hasAsk && !hasBid && !hasLastSale) {
            // Skip variants with no actionable market data
            continue
          }

          aliasData.set(v.size_display, {
            alias_variant_id: v.id,
            size_display: v.size_display,
            size_value: v.size_value,
            lowest_ask: market?.lowest_ask ?? null,
            highest_bid: market?.highest_bid ?? null,
            last_sale_price: market?.last_sale_price ?? null,
            global_indicator_price: market?.global_indicator_price ?? null,
            currency_code: market?.currency_code ?? null,
            updated_at: market?.updated_at ?? null,
          })
        }
      }
    }

    // Merge data - all unique sizes from both providers
    const allSizes = new Set([...stockxData.keys(), ...aliasData.keys()])
    const result: UnifiedMarketRow[] = []

    for (const size of allSizes) {
      const sx = stockxData.get(size)
      const al = aliasData.get(size)

      // Try to parse size as numeric
      const sizeNumeric = /^[0-9]+\.?[0-9]*$/.test(size) ? parseFloat(size) : null

      result.push({
        size_display: size,
        size_numeric: sizeNumeric,

        // StockX
        stockx_variant_id: sx?.stockx_variant_id ?? null,
        stockx_lowest_ask: sx?.lowest_ask ?? null,
        stockx_highest_bid: sx?.highest_bid ?? null,
        stockx_flex_lowest_ask: sx?.flex_lowest_ask ?? null,
        stockx_earn_more: sx?.earn_more ?? null,
        stockx_sell_faster: sx?.sell_faster ?? null,
        stockx_currency: sx?.currency_code ?? null,
        stockx_updated_at: sx?.updated_at ?? null,

        // Alias
        alias_variant_id: al?.alias_variant_id ?? null,
        alias_lowest_ask: al?.lowest_ask ?? null,
        alias_highest_bid: al?.highest_bid ?? null,
        alias_last_sale: al?.last_sale_price ?? null,
        alias_global_indicator: al?.global_indicator_price ?? null,
        alias_currency: al?.currency_code ?? null,
        alias_updated_at: al?.updated_at ?? null,

        // Flags
        has_stockx: !!sx,
        has_alias: !!al,
      })
    }

    // Sort by numeric size
    result.sort((a, b) => {
      if (a.size_numeric === null && b.size_numeric === null) return 0
      if (a.size_numeric === null) return 1
      if (b.size_numeric === null) return -1
      return a.size_numeric - b.size_numeric
    })

    return { data: result, error: null }
  } catch (err) {
    console.error('[UnifiedMarket:direct] Query error:', err)
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
