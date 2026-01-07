/**
 * Market Pricing Helpers
 * Convenience functions for querying flex + consigned pricing
 *
 * Usage:
 *   const prices = await getAllPricingOptions('DD1391-100', '10.5')
 *   // Returns: { stockx: { standard: {...}, flex: {...} }, alias: { standard: {...}, consigned: {...} } }
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

export interface PriceData {
  provider: string
  lowest_ask: number | null
  highest_bid: number | null
  last_sale_price: number | null
  spread_percentage: number | null
  sales_last_72h: number | null
  snapshot_at: string
  data_freshness: string
}

export interface StockXPricing {
  standard: PriceData | null
  flex: PriceData | null
}

export interface AliasPricing {
  standard: PriceData | null
  consigned: PriceData | null
}

export interface AllPricingOptions {
  stockx: StockXPricing
  alias: AliasPricing
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all pricing options for a SKU + size
 * Returns standard, flex, and consigned pricing from all providers
 */
export async function getAllPricingOptions(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<AllPricingOptions> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Query all variants for this SKU + size
  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode)
    .order('snapshot_at', { ascending: false })

  if (error) {
    console.error('[Pricing Helpers] Query error:', error)
    throw error
  }

  // Organize by provider and type
  const result: AllPricingOptions = {
    stockx: { standard: null, flex: null },
    alias: { standard: null, consigned: null },
  }

  if (!data || data.length === 0) {
    return result
  }

  for (const row of data) {
    const priceData: PriceData = {
      provider: row.provider,
      lowest_ask: row.lowest_ask,
      highest_bid: row.highest_bid,
      last_sale_price: row.last_sale_price,
      spread_percentage: row.spread_percentage,
      sales_last_72h: row.sales_last_72h,
      snapshot_at: row.snapshot_at,
      data_freshness: row.data_freshness,
    }

    if (row.provider === 'stockx') {
      if (row.is_flex) {
        result.stockx.flex = priceData
      } else {
        result.stockx.standard = priceData
      }
    } else if (row.provider === 'alias') {
      if (row.is_consigned) {
        result.alias.consigned = priceData
      } else {
        result.alias.standard = priceData
      }
    }
  }

  return result
}

/**
 * Get only standard (non-flex, non-consigned) pricing
 * Useful for default inventory display
 */
export async function getStandardPricing(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{ stockx: PriceData | null; alias: PriceData | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode)
    .eq('is_flex', false)
    .eq('is_consigned', false)
    .order('snapshot_at', { ascending: false })

  if (error) {
    console.error('[Pricing Helpers] Query error:', error)
    throw error
  }

  const result = { stockx: null as PriceData | null, alias: null as PriceData | null }

  if (!data || data.length === 0) {
    return result
  }

  for (const row of data) {
    const priceData: PriceData = {
      provider: row.provider,
      lowest_ask: row.lowest_ask,
      highest_bid: row.highest_bid,
      last_sale_price: row.last_sale_price,
      spread_percentage: row.spread_percentage,
      sales_last_72h: row.sales_last_72h,
      snapshot_at: row.snapshot_at,
      data_freshness: row.data_freshness,
    }

    if (row.provider === 'stockx') {
      result.stockx = priceData
    } else if (row.provider === 'alias') {
      result.alias = priceData
    }
  }

  return result
}

/**
 * Get best price across all options (standard + flex + consigned)
 * Returns the lowest ask price regardless of type
 */
export async function getBestPrice(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{
  provider: string
  lowest_ask: number
  is_flex: boolean
  is_consigned: boolean
  snapshot_at: string
} | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('master_market_latest')
    .select('*')
    .eq('sku', sku)
    .eq('size_key', sizeKey)
    .eq('currency_code', currencyCode)
    .not('lowest_ask', 'is', null)
    .order('lowest_ask', { ascending: true })
    .limit(1)

  if (error) {
    console.error('[Pricing Helpers] Query error:', error)
    throw error
  }

  if (!data || data.length === 0) {
    return null
  }

  const best = data[0]
  return {
    provider: best.provider,
    lowest_ask: best.lowest_ask,
    is_flex: best.is_flex,
    is_consigned: best.is_consigned,
    snapshot_at: best.snapshot_at,
  }
}

/**
 * Get flex savings for a specific size
 * Returns the difference between standard and flex pricing
 */
export async function getFlexSavings(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{
  standard_price: number | null
  flex_price: number | null
  savings: number | null
  savings_pct: number | null
} | null> {
  const all = await getAllPricingOptions(sku, sizeKey, currencyCode)

  if (!all.stockx.standard || !all.stockx.flex) {
    return null
  }

  const standardPrice = all.stockx.standard.lowest_ask
  const flexPrice = all.stockx.flex.lowest_ask

  if (!standardPrice || !flexPrice) {
    return null
  }

  const savings = standardPrice - flexPrice
  const savingsPct = (savings / standardPrice) * 100

  return {
    standard_price: standardPrice,
    flex_price: flexPrice,
    savings: savings,
    savings_pct: savingsPct,
  }
}

/**
 * Compare consigned vs standard Alias pricing
 */
export async function getConsignedComparison(
  sku: string,
  sizeKey: string,
  currencyCode: string = 'USD'
): Promise<{
  standard_price: number | null
  consigned_price: number | null
  difference: number | null
  difference_pct: number | null
} | null> {
  const all = await getAllPricingOptions(sku, sizeKey, currencyCode)

  if (!all.alias.standard || !all.alias.consigned) {
    return null
  }

  const standardPrice = all.alias.standard.lowest_ask
  const consignedPrice = all.alias.consigned.lowest_ask

  if (!standardPrice || !consignedPrice) {
    return null
  }

  const difference = consignedPrice - standardPrice
  const differencePct = (difference / standardPrice) * 100

  return {
    standard_price: standardPrice,
    consigned_price: consignedPrice,
    difference: difference,
    difference_pct: differencePct,
  }
}
