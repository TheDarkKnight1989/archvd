/**
 * ARCHVD V4 Pricing Types
 *
 * Fresh V4 implementation for fee-adjusted pricing across platforms.
 * Used by the ARCHVD Smart Price system.
 *
 * CONVENTIONS:
 * - All fee percentages stored as FRACTIONS (0.09 = 9%, not 9)
 * - All prices in major currency units (e.g., £240.00, not pence)
 * - Size is US by default, sizeUnit specifies if different
 */

// =============================================================================
// CURRENCY TYPES
// =============================================================================

export type Currency = 'GBP' | 'USD' | 'EUR'

/**
 * FX rates with per-leg tracking
 *
 * Supports provider → user currency conversions AND cost input conversion.
 * This is NOT a full currency matrix. Do not use for arbitrary GBP↔USD conversions.
 *
 * Use cases:
 * - GBP (StockX) → user currency ✓
 * - USD (Alias) → user currency ✓
 * - EUR (user cost input) → user currency ✓
 * - GBP → USD directly ✗ (not supported)
 */
export interface FxRates {
  /** GBP → user currency rate */
  gbpToUser: number
  /** USD → user currency rate */
  usdToUser: number
  /** EUR → user currency rate (for cost input, not platform data) */
  eurToUser: number
  /** The user's display currency */
  userCurrency: Currency
  /** When these rates were fetched */
  timestamp: string
}

// =============================================================================
// PLATFORM FEE TYPES
// =============================================================================

export type Platform = 'stockx' | 'alias'

/**
 * StockX seller levels (1-5)
 * Fee % decreases as level increases
 */
export type StockXSellerLevel = 1 | 2 | 3 | 4 | 5

/**
 * StockX fee percentages by seller level (as FRACTIONS)
 * Source: existing codebase (useStockxListings.ts, MarkAsSoldModal.tsx)
 */
export const STOCKX_SELLER_LEVEL_FEES: Record<StockXSellerLevel, number> = {
  1: 0.09, // 9.0%
  2: 0.085, // 8.5%
  3: 0.08, // 8.0%
  4: 0.075, // 7.5%
  5: 0.07, // 7.0%
}

/**
 * Fee profile - user's fee configuration
 * Loaded from user_settings table
 *
 * NOTE: All percentage fields are FRACTIONS (0.095 = 9.5%)
 */
export interface FeeProfile {
  stockxSellerLevel: StockXSellerLevel
  /** User's custom shipping in GBP (default £4) */
  stockxShippingFee: number
  /** Alias commission as FRACTION (0.095 = 9.5%) */
  aliasCommissionFee: number
  /**
   * Seller's region for Alias fee calculation.
   * Affects shipping costs (prepaid label prices differ by region).
   *
   * NOTE: This affects FEES only, not market data.
   * Market data region is selected separately via aliasRegion param in hooks/RPC
   * (region '1'=UK, '2'=EU, '3'=US) to control which liquidity pool you query.
   */
  aliasSellerRegion: 'uk' | 'us' | 'eu'
  aliasShippingMethod: 'dropoff' | 'prepaid'
}

/**
 * Default fee profile
 * NOTE: aliasCommissionFee is a FRACTION (0.095 = 9.5%)
 */
export const DEFAULT_FEE_PROFILE: FeeProfile = {
  stockxSellerLevel: 1,
  stockxShippingFee: 4.0, // £4 UK shipping
  aliasCommissionFee: 0.095, // 9.5% as fraction
  aliasSellerRegion: 'uk',
  aliasShippingMethod: 'dropoff',
}

export interface PlatformFeeConfig {
  /** Platform's seller fee percentage as FRACTION (0.09 = 9%) */
  sellerFeePercent: number

  /** Payment processing fee as FRACTION (0.03 = 3%) */
  paymentProcessingPercent: number

  /** Fixed shipping cost to platform (in platform's currency) */
  shippingCost: number

  /** Minimum fee charged (in platform's currency) */
  minimumFee: number

  /** Native currency of the platform */
  currency: Currency
}

export interface FeeBreakdown {
  platformFee: number
  paymentFee: number
  shipping: number
  total: number
}

// =============================================================================
// NET PROCEEDS TYPES
// =============================================================================

export interface PlatformNetProceeds {
  platform: Platform

  /** Sale price before fees */
  grossPrice: number
  grossPriceCurrency: Currency

  /** Fee breakdown */
  fees: FeeBreakdown

  /** What seller actually receives (in platform currency) */
  netReceive: number
  netReceiveCurrency: Currency

  /** Net receive converted to user's preferred currency */
  netReceiveUserCurrency: number
}

// =============================================================================
// ARCHVD PRICE TYPES
// =============================================================================

/** Source of the ARCHVD price - always single winner with min() formula */
export type PriceSource = 'stockx' | 'alias'

/**
 * Price confidence based on data availability:
 * - high: Both StockX and Alias data available (cross-validated)
 * - medium: Only one provider has data
 * - low: Data exists but is stale or has quality issues
 */
export type PriceConfidence = 'high' | 'medium' | 'low'

/**
 * Data freshness based on age:
 * - live: < 1 hour old
 * - recent: < 24 hours old
 * - stale: > 24 hours old
 */
export type DataFreshness = 'live' | 'recent' | 'stale'

/** Freshness threshold constants (milliseconds) */
export const FRESHNESS_THRESHOLDS = {
  LIVE_MAX_AGE_MS: 60 * 60 * 1000, // 1 hour
  RECENT_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const

/** Size system for display and conversion */
export type SizeUnit = 'US' | 'UK' | 'EU'

/**
 * Provider data status - distinguishes "no data" from "error"
 */
export type ProviderDataStatus = 'available' | 'no_listing' | 'error' | 'not_mapped'

/**
 * Per-provider freshness tracking
 */
export interface ProviderFreshness {
  updatedAt: string | null
  freshness: DataFreshness
  status: ProviderDataStatus
  error?: string
}

export interface ArchvdPriceInputs {
  /** StockX ask converted to user currency (null if unavailable) */
  stockxAsk: number | null
  /** Original StockX ask in platform currency (GBP/EUR/USD depending on region) */
  stockxAskOriginal: number | null

  /** Alias ask converted to user currency (null if unavailable) */
  aliasAsk: number | null
  /** Original Alias ask in USD */
  aliasAskOriginal: number | null

  /** FX rates used for conversion */
  fx: FxRates
}

/**
 * Bid data for spread calculation and instant-sell logic
 */
export interface ArchvdBids {
  /** StockX highest bid converted to user currency */
  stockxBid: number | null
  /** Original StockX bid in platform currency (GBP/EUR/USD depending on region) */
  stockxBidOriginal: number | null
  /** Alias highest bid converted to user currency */
  aliasBid: number | null
  /** Original Alias bid in USD */
  aliasBidOriginal: number | null
}

export interface ArchvdPrice {
  // === SIZE-SCOPED IDENTITY (critical for cache keys) ===
  /** The canonical SKU identifier */
  styleId: string
  /** Size value as text (e.g., "10", "10.5") */
  size: string
  /** Size unit - defaults to US if not specified */
  sizeUnit: SizeUnit

  /** Variant IDs for direct DB lookups */
  variantIds?: {
    stockxVariantId?: string
    /** Alias variant ID (BIGSERIAL in DB, can be string or number) */
    aliasVariantId?: string | number
  }

  // === PRICE DATA (ASKS) ===
  /** The headline ARCHVD market price users see (lowest ask) */
  value: number
  currency: Currency

  /** Which platform provided this price (winner of min()) */
  source: PriceSource

  /** Confidence level based on data availability */
  confidence: PriceConfidence

  /** Raw inputs for transparency */
  inputs: ArchvdPriceInputs

  // === BID DATA (for spread/instant-sell) ===
  /** Highest bids from each platform */
  bids: ArchvdBids

  /** When this price was calculated */
  calculatedAt: string

  /** Per-provider freshness (more granular than single freshness) */
  providerFreshness: {
    stockx: ProviderFreshness
    alias: ProviderFreshness
  }
}

// =============================================================================
// ARCHVD PRICE WITH FEES (Extended)
// =============================================================================

export interface ArchvdPriceWithFees extends ArchvdPrice {
  /** Net proceeds breakdown by platform (based on ASKS - patient sell) */
  netProceeds: {
    stockx: PlatformNetProceeds | null
    alias: PlatformNetProceeds | null
  }

  /** Net proceeds at highest BID (instant sell payout) */
  bidNetProceeds: {
    stockx: PlatformNetProceeds | null
    alias: PlatformNetProceeds | null
  }

  /** Best instant payout (highest bid net proceeds) */
  bestBidNetProceeds: number | null

  /** Platform with best instant payout */
  bestBidPlatform: Platform | null

  /** Recommended platform to sell on for maximum profit */
  bestPlatformToSell: Platform | null

  /** Best net proceeds in user's currency */
  bestNetProceeds: number | null

  /** How much more you get on best platform vs alternative */
  platformAdvantage: number | null

  /** Real profit after fees (best platform net - user cost) */
  realProfit: number | null

  /** Real profit as percentage of user's cost */
  realProfitPercent: number | null

  /**
   * Alias-only extended data (StockX V2 API doesn't provide these)
   * - lastSalePrice: Most recent sale price (USD, converted to user currency)
   * - salesLast72h: Number of sales in last 72 hours
   * - salesLast30d: Number of sales in last 30 days
   */
  aliasExtended?: {
    lastSalePrice: number | null
    lastSalePriceUserCurrency: number | null
    salesLast72h: number | null
    salesLast30d: number | null
  }
}

// =============================================================================
// MARKET DATA INPUT TYPES
// =============================================================================

export interface StockXMarketInput {
  lowestAsk: number | null
  highestBid: number | null
  flexLowestAsk?: number | null
  earnMore?: number | null
  sellFaster?: number | null
  /** Currency of the price data (GBP, EUR, USD). Defaults to GBP if not specified. */
  currency?: Currency
  /** When this data was fetched */
  updatedAt?: string | null
  /** Data status */
  status?: ProviderDataStatus
  /** Error message if status is 'error' */
  error?: string
}

export interface AliasMarketInput {
  lowestAsk: number | null // USD (always)
  highestBid: number | null // USD
  lastSalePrice?: number | null
  globalIndicatorPrice?: number | null
  /** Sales volume in last 72 hours (Alias-only data) */
  salesLast72h?: number | null
  /** Sales volume in last 30 days (Alias-only data) */
  salesLast30d?: number | null
  /** When this data was fetched */
  updatedAt?: string | null
  /** Data status */
  status?: ProviderDataStatus
  /** Error message if status is 'error' */
  error?: string
}

/**
 * Unified market input - size-scoped market data
 */
export interface UnifiedMarketInput {
  /** Required: size-scoped identity */
  styleId: string
  size: string
  /** Size unit - defaults to US if not specified */
  sizeUnit?: SizeUnit

  /** Optional: variant IDs for caching */
  variantIds?: {
    stockxVariantId?: string
    aliasVariantId?: string | number
  }

  /** Market data from providers */
  stockx: StockXMarketInput | null
  alias: AliasMarketInput | null
}

// =============================================================================
// COST INPUT (separate from options for cache safety)
// =============================================================================

/**
 * User's cost basis for profit calculation
 * Kept separate from CalculationOptions to prevent cache key pollution
 */
export interface CostInput {
  /** Purchase price */
  amount: number
  /** Currency of purchase price */
  currency: Currency
}

// =============================================================================
// CALCULATION OPTIONS (pure config, no item-specific data)
// =============================================================================

/**
 * Configuration options for price calculation
 *
 * NOTE: This should contain ONLY config, not item-specific data.
 * User cost is passed separately to prevent cache key issues.
 */
export interface CalculationOptions {
  /** FX rates for conversion */
  fxRates: FxRates

  /** User's fee profile (seller level, shipping, etc.) */
  feeProfile?: FeeProfile
}
