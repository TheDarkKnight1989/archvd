/**
 * ARCHVD Smart Price Calculation
 *
 * Fresh V4 implementation for the unified market price engine.
 * Combines StockX + Alias data into a single trusted price with fee-adjusted profits.
 *
 * Key features:
 * - Size-scoped (all prices tied to styleId + size + sizeUnit)
 * - Per-provider freshness tracking
 * - Fee profile support (seller levels, regions)
 * - Distinguishes "no listing" from "error"
 * - Bid data for spread/instant-sell
 * - Cost separated from options for cache safety
 */

import type {
  ArchvdPrice,
  ArchvdPriceWithFees,
  ArchvdBids,
  FxRates,
  UnifiedMarketInput,
  PriceSource,
  PriceConfidence,
  DataFreshness,
  ArchvdPriceInputs,
  CalculationOptions,
  CostInput,
  ProviderFreshness,
  ProviderDataStatus,
} from './types'

import { DEFAULT_FEE_PROFILE, FRESHNESS_THRESHOLDS } from './types'

import {
  calculateNetProceeds,
  convertToUserCurrency,
  getBestPlatform,
  calculateRealProfit,
} from './fees'

// =============================================================================
// ARCHVD PRICE CALCULATION
// =============================================================================

/**
 * Calculate the ARCHVD Smart Price
 *
 * Formula: min(stockx_lowest_ask, alias_lowest_ask) normalized to user currency
 *
 * This is the headline number users see - a single trusted market price
 * like Kelley Blue Book for sneakers.
 */
export function calculateArchvdPrice(
  input: UnifiedMarketInput,
  options: CalculationOptions
): ArchvdPrice | null {
  const { fxRates } = options
  const { styleId, size, sizeUnit = 'US', variantIds, stockx, alias } = input

  // Extract lowest asks
  const stockxAsk = stockx?.lowestAsk ?? null
  const aliasAsk = alias?.lowestAsk ?? null

  // If no data from either source, return null
  if (stockxAsk === null && aliasAsk === null) {
    return null
  }

  // Get StockX currency (now supports GBP/EUR/USD based on region)
  const stockxCurrency = stockx?.currency ?? 'GBP'

  // Convert asks to user's currency
  const stockxInUserCurrency =
    stockxAsk !== null ? convertToUserCurrency(stockxAsk, stockxCurrency, fxRates) : null

  const aliasInUserCurrency =
    aliasAsk !== null ? convertToUserCurrency(aliasAsk, 'USD', fxRates) : null

  // Determine ARCHVD price, source, and confidence
  let value: number
  let source: PriceSource
  let confidence: PriceConfidence

  if (stockxInUserCurrency !== null && aliasInUserCurrency !== null) {
    // Both sources available - take minimum, high confidence
    value = Math.min(stockxInUserCurrency, aliasInUserCurrency)
    source = stockxInUserCurrency <= aliasInUserCurrency ? 'stockx' : 'alias'
    confidence = 'high'
  } else if (stockxInUserCurrency !== null) {
    // Only StockX available - medium confidence
    value = stockxInUserCurrency
    source = 'stockx'
    confidence = 'medium'
  } else if (aliasInUserCurrency !== null) {
    // Only Alias available - medium confidence
    value = aliasInUserCurrency
    source = 'alias'
    confidence = 'medium'
  } else {
    // Both null - should never reach here due to early return, but TypeScript needs this
    return null
  }

  // Build inputs for transparency
  const inputs: ArchvdPriceInputs = {
    stockxAsk: stockxInUserCurrency,
    stockxAskOriginal: stockxAsk,
    aliasAsk: aliasInUserCurrency,
    aliasAskOriginal: aliasAsk,
    fx: fxRates,
  }

  // Build bids for spread/instant-sell
  const stockxBid = stockx?.highestBid ?? null
  const aliasBid = alias?.highestBid ?? null
  const bids: ArchvdBids = {
    stockxBid: stockxBid !== null ? convertToUserCurrency(stockxBid, stockxCurrency, fxRates) : null,
    stockxBidOriginal: stockxBid,
    aliasBid: aliasBid !== null ? convertToUserCurrency(aliasBid, 'USD', fxRates) : null,
    aliasBidOriginal: aliasBid,
  }

  // Build per-provider freshness
  const providerFreshness = {
    stockx: buildProviderFreshness(stockx?.updatedAt, stockx?.status, stockxAsk, stockx?.error),
    alias: buildProviderFreshness(alias?.updatedAt, alias?.status, aliasAsk, alias?.error),
  }

  // Downgrade confidence if winning provider is stale or errored
  const winnerFreshness = source === 'stockx' ? providerFreshness.stockx : providerFreshness.alias
  if (winnerFreshness.status === 'error' || winnerFreshness.freshness === 'stale') {
    confidence = 'low'
  }

  return {
    // Size-scoped identity
    styleId,
    size,
    sizeUnit,
    variantIds,

    // Price data (asks)
    value: roundToCents(value),
    currency: fxRates.userCurrency,
    source,
    confidence,
    inputs,

    // Bid data
    bids,

    calculatedAt: new Date().toISOString(),
    providerFreshness,
  }
}

// =============================================================================
// ARCHVD PRICE WITH FEES (Extended)
// =============================================================================

/**
 * Calculate ARCHVD Price with full fee breakdown and platform recommendation
 *
 * This is the complete picture:
 * - ARCHVD market price (headline number)
 * - Net proceeds per platform (what you actually receive)
 * - Best platform recommendation
 * - Real profit after fees
 *
 * @param input - Market data (size-scoped)
 * @param cost - User's cost basis (separate for cache safety)
 * @param options - Config (FX rates, fee profile)
 */
export function calculateArchvdPriceWithFees(
  input: UnifiedMarketInput,
  cost: CostInput | null,
  options: CalculationOptions
): ArchvdPriceWithFees | null {
  const { fxRates, feeProfile = DEFAULT_FEE_PROFILE } = options

  // Get base ARCHVD price
  const basePrice = calculateArchvdPrice(input, options)
  if (!basePrice) {
    return null
  }

  // Extract lowest asks for net proceeds calculation
  const stockxAsk = input.stockx?.lowestAsk ?? null
  const aliasAsk = input.alias?.lowestAsk ?? null

  // Extract highest bids for instant sell calculation
  const stockxBid = input.stockx?.highestBid ?? null
  const aliasBid = input.alias?.highestBid ?? null

  // Get StockX currency (now supports GBP/EUR/USD based on region)
  const stockxCurrency = input.stockx?.currency ?? 'GBP'

  // Calculate net proceeds for each platform (ASKS - patient sell)
  // Pass the actual currency for StockX (varies by region)
  const stockxNet =
    stockxAsk !== null
      ? calculateNetProceeds(stockxAsk, 'stockx', fxRates, feeProfile, stockxCurrency)
      : null

  // Alias is always USD
  const aliasNet =
    aliasAsk !== null
      ? calculateNetProceeds(aliasAsk, 'alias', fxRates, feeProfile, 'USD')
      : null

  // Calculate BID net proceeds (instant sell payout)
  const stockxBidNet =
    stockxBid !== null
      ? calculateNetProceeds(stockxBid, 'stockx', fxRates, feeProfile, stockxCurrency)
      : null

  const aliasBidNet =
    aliasBid !== null
      ? calculateNetProceeds(aliasBid, 'alias', fxRates, feeProfile, 'USD')
      : null

  // Determine best platform for instant sell (based on bid net proceeds)
  const { platform: bestBidPlatform } = getBestPlatform(stockxBidNet, aliasBidNet)

  // Get best bid net proceeds (instant payout)
  const bestBidNetProceeds =
    bestBidPlatform === 'stockx'
      ? stockxBidNet?.netReceiveUserCurrency ?? null
      : bestBidPlatform === 'alias'
        ? aliasBidNet?.netReceiveUserCurrency ?? null
        : null

  // Determine best platform for asks
  const { platform: bestPlatform, advantage: platformAdvantage } =
    getBestPlatform(stockxNet, aliasNet)

  // Get best net proceeds
  const bestNetProceeds =
    bestPlatform === 'stockx'
      ? stockxNet?.netReceiveUserCurrency ?? null
      : bestPlatform === 'alias'
        ? aliasNet?.netReceiveUserCurrency ?? null
        : null

  // Calculate real profit (if cost provided)
  let realProfit: number | null = null
  let realProfitPercent: number | null = null

  if (cost !== null && bestNetProceeds !== null) {
    // Convert user cost to user currency if different
    const costInUserCurrency =
      cost.currency !== fxRates.userCurrency
        ? convertToUserCurrency(cost.amount, cost.currency, fxRates)
        : cost.amount

    const profitResult = calculateRealProfit(bestNetProceeds, costInUserCurrency)
    realProfit = profitResult.profit
    realProfitPercent = profitResult.profitPercent
  }

  // Build Alias extended data (Last Sale + Volume - Alias-only)
  const aliasLastSale = input.alias?.lastSalePrice ?? null
  const aliasExtended = {
    lastSalePrice: aliasLastSale,
    lastSalePriceUserCurrency: aliasLastSale !== null
      ? convertToUserCurrency(aliasLastSale, 'USD', fxRates)
      : null,
    salesLast72h: input.alias?.salesLast72h ?? null,
    salesLast30d: input.alias?.salesLast30d ?? null,
  }

  return {
    ...basePrice,
    netProceeds: {
      stockx: stockxNet,
      alias: aliasNet,
    },
    bidNetProceeds: {
      stockx: stockxBidNet,
      alias: aliasBidNet,
    },
    bestBidNetProceeds,
    bestBidPlatform,
    bestPlatformToSell: bestPlatform,
    bestNetProceeds,
    platformAdvantage,
    realProfit,
    realProfitPercent,
    aliasExtended,
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick check if we have any market data
 */
export function hasMarketData(input: UnifiedMarketInput): boolean {
  return (
    (input.stockx?.lowestAsk ?? null) !== null ||
    (input.alias?.lowestAsk ?? null) !== null
  )
}

/**
 * Get data availability status
 */
export function getDataAvailability(input: UnifiedMarketInput): {
  hasStockX: boolean
  hasAlias: boolean
  hasBoth: boolean
  hasAny: boolean
} {
  const hasStockX = (input.stockx?.lowestAsk ?? null) !== null
  const hasAlias = (input.alias?.lowestAsk ?? null) !== null

  return {
    hasStockX,
    hasAlias,
    hasBoth: hasStockX && hasAlias,
    hasAny: hasStockX || hasAlias,
  }
}

/**
 * Get provider statuses even when no price data available.
 *
 * Use this when calculateArchvdPrice() returns null to understand WHY:
 * - 'no_listing' → No asks available (normal state)
 * - 'error' → API error (show retry / error state)
 * - 'not_mapped' → Product not mapped to this provider
 *
 * This prevents the UI from collapsing all failure states to just "—".
 */
export function getProviderStatuses(input: UnifiedMarketInput): {
  stockx: ProviderFreshness
  alias: ProviderFreshness
} {
  return {
    stockx: buildProviderFreshness(
      input.stockx?.updatedAt,
      input.stockx?.status,
      input.stockx?.lowestAsk ?? null,
      input.stockx?.error
    ),
    alias: buildProviderFreshness(
      input.alias?.updatedAt,
      input.alias?.status,
      input.alias?.lowestAsk ?? null,
      input.alias?.error
    ),
  }
}

/**
 * Determine data freshness based on timestamp
 * Uses FRESHNESS_THRESHOLDS from types.ts
 */
export function determineDataFreshness(dataTimestamp: string | null): DataFreshness {
  if (!dataTimestamp) return 'stale'

  const dataTime = new Date(dataTimestamp).getTime()
  const now = Date.now()
  // Guard against clock skew: if timestamp is in the future, treat as 0 age
  const ageMs = Math.max(0, now - dataTime)

  if (ageMs < FRESHNESS_THRESHOLDS.LIVE_MAX_AGE_MS) return 'live'
  if (ageMs < FRESHNESS_THRESHOLDS.RECENT_MAX_AGE_MS) return 'recent'
  return 'stale'
}

/**
 * Build provider freshness object
 */
function buildProviderFreshness(
  updatedAt: string | null | undefined,
  status: ProviderDataStatus | undefined,
  ask: number | null,
  error?: string
): ProviderFreshness {
  // "Error wins" - if error string is provided, force status to 'error'
  if (error) {
    return {
      updatedAt: updatedAt ?? null,
      freshness: determineDataFreshness(updatedAt ?? null),
      status: 'error',
      error,
    }
  }

  // Determine status from explicit value or infer from ask
  // Key invariant: 'available' requires ask !== null, otherwise it's a "ghost available"
  let derivedStatus: ProviderDataStatus = status ?? 'available'

  if (ask === null) {
    // No ask data → force to no_listing unless explicitly error/not_mapped
    if (derivedStatus === 'available') {
      derivedStatus = 'no_listing'
    }
  } else {
    // Ask is present → available unless explicitly not_mapped (rare)
    if (!status) {
      derivedStatus = 'available'
    }
  }

  return {
    updatedAt: updatedAt ?? null,
    freshness: determineDataFreshness(updatedAt ?? null),
    status: derivedStatus,
  }
}

// =============================================================================
// DEFAULT FX RATES
// =============================================================================

/**
 * Get default FX rates for a given user currency (fallback when live rates unavailable)
 */
export function getDefaultFxRates(userCurrency: 'GBP' | 'USD' | 'EUR' = 'GBP'): FxRates {
  // Default rates (update periodically or fetch from FX service)
  const rates = {
    GBP_USD: 1.27,
    USD_GBP: 0.79,
    GBP_EUR: 1.17,
    EUR_GBP: 0.85,
    USD_EUR: 0.92,
    EUR_USD: 1.09,
  }

  // Build user-centric rates
  if (userCurrency === 'GBP') {
    return {
      gbpToUser: 1.0,
      usdToUser: rates.USD_GBP,
      eurToUser: rates.EUR_GBP,
      userCurrency: 'GBP',
      timestamp: new Date().toISOString(),
    }
  }

  if (userCurrency === 'USD') {
    return {
      gbpToUser: rates.GBP_USD,
      usdToUser: 1.0,
      eurToUser: rates.EUR_USD,
      userCurrency: 'USD',
      timestamp: new Date().toISOString(),
    }
  }

  // EUR
  return {
    gbpToUser: rates.GBP_EUR,
    usdToUser: rates.USD_EUR,
    eurToUser: 1.0,
    userCurrency: 'EUR',
    timestamp: new Date().toISOString(),
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}
