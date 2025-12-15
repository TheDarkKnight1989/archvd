/**
 * ARCHVD V4 Platform Fee Configuration
 *
 * Fresh V4 implementation for calculating platform fees and net proceeds.
 * This is the honest numbers engine - shows what sellers ACTUALLY receive.
 *
 * Supports:
 * - StockX seller levels (1-5) with dynamic fee %
 * - Alias region-based shipping (UK/EU/US)
 * - User-configurable shipping and commission fees
 */

import type {
  Platform,
  PlatformFeeConfig,
  PlatformNetProceeds,
  FeeBreakdown,
  Currency,
  FxRates,
  FeeProfile,
  StockXSellerLevel,
} from './types'

import { STOCKX_SELLER_LEVEL_FEES, DEFAULT_FEE_PROFILE } from './types'

// =============================================================================
// ALIAS SHIPPING FEES (ALL VALUES IN USD)
// =============================================================================

/**
 * Alias seller shipping fees by region and method.
 * ALL VALUES ARE IN USD - this is per Alias policy.
 *
 * Source: Alias fee policy page (captured August 2025).
 * NOTE: These values are from internal reference. Public docs may not
 * list exact shipping fees in a stable format. See ALIAS_FEE_REFERENCE.md.
 *
 * EU is a simplified average - actual fees vary by country.
 * Germany/Netherlands have lower fees, Southern/Eastern EU higher.
 */
const ALIAS_SHIPPING_FEES_USD: Record<
  'uk' | 'us' | 'eu',
  Record<'dropoff' | 'prepaid', number>
> = {
  us: { dropoff: 0, prepaid: 5 },
  uk: { dropoff: 2, prepaid: 5 },
  eu: { dropoff: 5, prepaid: 8 }, // Conservative average
}

// =============================================================================
// PLATFORM FEE CALCULATION
// =============================================================================

/**
 * Clamp StockX seller level to valid range (1-5)
 */
function clampSellerLevel(level: number): StockXSellerLevel {
  return Math.min(5, Math.max(1, Math.round(level))) as StockXSellerLevel
}

/** Valid Alias seller regions */
const VALID_ALIAS_REGIONS = ['uk', 'us', 'eu'] as const
type AliasRegion = (typeof VALID_ALIAS_REGIONS)[number]

/** Valid Alias shipping methods */
const VALID_ALIAS_METHODS = ['dropoff', 'prepaid'] as const
type AliasMethod = (typeof VALID_ALIAS_METHODS)[number]

/**
 * Normalize and validate alias region
 */
function normalizeAliasRegion(input: string | undefined | null): AliasRegion {
  const normalized = (input ?? '').toLowerCase().trim()
  if (VALID_ALIAS_REGIONS.includes(normalized as AliasRegion)) {
    return normalized as AliasRegion
  }
  return DEFAULT_FEE_PROFILE.aliasSellerRegion
}

/**
 * Normalize and validate alias shipping method
 */
function normalizeAliasMethod(input: string | undefined | null): AliasMethod {
  const normalized = (input ?? '').toLowerCase().trim()
  if (VALID_ALIAS_METHODS.includes(normalized as AliasMethod)) {
    return normalized as AliasMethod
  }
  return DEFAULT_FEE_PROFILE.aliasShippingMethod
}

/**
 * Get platform fee config based on user's fee profile
 */
export function getPlatformFeeConfig(
  platform: Platform,
  feeProfile: FeeProfile = DEFAULT_FEE_PROFILE
): PlatformFeeConfig {
  if (platform === 'stockx') {
    const rawLevel = feeProfile.stockxSellerLevel ?? 1
    const level = clampSellerLevel(rawLevel)
    const sellerFee = STOCKX_SELLER_LEVEL_FEES[level]
    // Clamp shipping to reasonable range [0, 50] GBP
    const shippingRaw = feeProfile.stockxShippingFee ?? 4.0
    const shippingCost = Math.min(50, Math.max(0, shippingRaw))

    return {
      sellerFeePercent: sellerFee,
      paymentProcessingPercent: 0.03, // 3% - fixed
      shippingCost, // User-configurable, GBP
      minimumFee: 5.0, // £5 minimum
      currency: 'GBP',
    }
  }

  // Alias - all fees in USD
  const region = normalizeAliasRegion(feeProfile.aliasSellerRegion)
  const method = normalizeAliasMethod(feeProfile.aliasShippingMethod)
  const commissionRaw = feeProfile.aliasCommissionFee ?? DEFAULT_FEE_PROFILE.aliasCommissionFee
  // Clamp to valid fraction range [0, 1] - protects against bad DB values
  const commissionPct = Math.min(1, Math.max(0, commissionRaw))

  return {
    sellerFeePercent: commissionPct,
    paymentProcessingPercent: 0.029, // 2.9% cash out fee
    shippingCost: ALIAS_SHIPPING_FEES_USD[region][method], // Already in USD
    minimumFee: 0, // No minimum
    currency: 'USD',
  }
}

/**
 * Calculate fee breakdown for a sale on a specific platform.
 *
 * @throws Error if grossPrice is <= 0
 * NOTE: This should never happen with valid market data.
 * Callers (calculateArchvdPriceWithFees) filter null asks before calling.
 */
export function calculateFees(
  grossPrice: number,
  platform: Platform,
  feeProfile: FeeProfile = DEFAULT_FEE_PROFILE
): FeeBreakdown {
  if (grossPrice <= 0) {
    throw new Error(`grossPrice must be > 0, got ${grossPrice}`)
  }

  const config = getPlatformFeeConfig(platform, feeProfile)

  const platformFee = Math.max(
    grossPrice * config.sellerFeePercent,
    config.minimumFee
  )
  const paymentFee = grossPrice * config.paymentProcessingPercent
  const shipping = config.shippingCost
  const total = platformFee + paymentFee + shipping

  return {
    platformFee: roundToCents(platformFee),
    paymentFee: roundToCents(paymentFee),
    shipping: roundToCents(shipping),
    total: roundToCents(total),
  }
}

/**
 * Calculate net proceeds (what seller actually receives)
 *
 * @param grossPrice - Sale price in platform currency
 * @param platform - 'stockx' or 'alias'
 * @param fxRates - FX rates for currency conversion
 * @param feeProfile - User's fee configuration
 * @param grossPriceCurrency - Optional: override the currency of grossPrice.
 *   For StockX, this should match the region (GBP/EUR/USD).
 *   If not provided, uses the platform's default currency.
 */
export function calculateNetProceeds(
  grossPrice: number,
  platform: Platform,
  fxRates: FxRates,
  feeProfile: FeeProfile = DEFAULT_FEE_PROFILE,
  grossPriceCurrency?: Currency
): PlatformNetProceeds {
  const config = getPlatformFeeConfig(platform, feeProfile)
  const fees = calculateFees(grossPrice, platform, feeProfile)
  const netReceive = roundToCents(grossPrice - fees.total)

  // Use provided currency or fall back to platform default
  const currency = grossPriceCurrency ?? config.currency

  // Convert net receive to user's currency
  const netReceiveUserCurrency = convertToUserCurrency(
    netReceive,
    currency,
    fxRates
  )

  return {
    platform,
    grossPrice,
    grossPriceCurrency: currency,
    fees,
    netReceive,
    netReceiveCurrency: currency,
    netReceiveUserCurrency: roundToCents(netReceiveUserCurrency),
  }
}

// =============================================================================
// CURRENCY CONVERSION
// =============================================================================

/**
 * Convert amount to user's currency using FX rates.
 *
 * SUPPORTED: GBP → user, USD → user, EUR → user
 *
 * Named explicitly to avoid collision with generic "convertCurrency" utils
 * and to make the limitation clear: this is source→user only.
 *
 * @throws Error if unsupported currency conversion is attempted
 */
export function convertToUserCurrency(
  amount: number,
  from: Currency,
  fxRates: FxRates
): number {
  const { userCurrency, gbpToUser, usdToUser, eurToUser } = fxRates

  // Same currency - no conversion needed
  if (from === userCurrency) return amount

  // GBP → user currency
  if (from === 'GBP') {
    return amount * gbpToUser
  }

  // USD → user currency
  if (from === 'USD') {
    return amount * usdToUser
  }

  // EUR → user currency (for cost input)
  if (from === 'EUR') {
    return amount * eurToUser
  }

  // Should never reach here if Currency type is respected
  throw new Error(
    `Unsupported currency conversion: ${from} → ${userCurrency}`
  )
}

/**
 * Get the FX rate for a specific conversion.
 *
 * @throws Error if unsupported currency is requested
 */
export function getFxRate(from: Currency, fxRates: FxRates): number {
  const { userCurrency, gbpToUser, usdToUser, eurToUser } = fxRates

  if (from === userCurrency) return 1.0
  if (from === 'GBP') return gbpToUser
  if (from === 'USD') return usdToUser
  if (from === 'EUR') return eurToUser

  throw new Error(`Unsupported FX rate request: ${from} → ${userCurrency}`)
}

// =============================================================================
// COMPARISON HELPERS
// =============================================================================

/**
 * Compare net proceeds between platforms
 * Returns the platform with better net proceeds
 */
export function getBestPlatform(
  stockxNet: PlatformNetProceeds | null,
  aliasNet: PlatformNetProceeds | null
): { platform: Platform | null; advantage: number | null } {
  if (!stockxNet && !aliasNet) {
    return { platform: null, advantage: null }
  }

  if (!stockxNet) {
    return { platform: 'alias', advantage: null }
  }

  if (!aliasNet) {
    return { platform: 'stockx', advantage: null }
  }

  // Compare in user currency for fair comparison
  const stockxValue = stockxNet.netReceiveUserCurrency
  const aliasValue = aliasNet.netReceiveUserCurrency
  const advantage = Math.abs(stockxValue - aliasValue)

  if (stockxValue >= aliasValue) {
    return { platform: 'stockx', advantage: roundToCents(advantage) }
  } else {
    return { platform: 'alias', advantage: roundToCents(advantage) }
  }
}

/**
 * Calculate real profit (net proceeds - cost)
 */
export function calculateRealProfit(
  netProceeds: number,
  cost: number
): { profit: number; profitPercent: number } {
  const profit = roundToCents(netProceeds - cost)
  const profitPercent = cost > 0 ? (profit / cost) * 100 : 0

  return {
    profit,
    profitPercent: Math.round(profitPercent * 10) / 10, // 1 decimal place
  }
}

// =============================================================================
// FEE PROFILE HELPERS
// =============================================================================

/**
 * Build fee profile from user settings.
 * Use this when loading from user_settings table.
 *
 * NOTE: Database stores alias_commission_fee as percentage (9.5),
 * but FeeProfile stores it as fraction (0.095). This function converts.
 *
 * IMPORTANT: DB column should be named alias_commission_fee_percent
 * to make the unit clear and prevent future confusion.
 */
export function buildFeeProfile(settings: {
  stockx_seller_level?: number
  stockx_shipping_fee?: number
  alias_commission_fee?: number // DB stores as percentage (9.5)
  alias_region?: string
  alias_shipping_method?: string
}): FeeProfile {
  // Convert alias_commission_fee from percentage (9.5) to fraction (0.095)
  let aliasCommissionFee = DEFAULT_FEE_PROFILE.aliasCommissionFee

  if (settings.alias_commission_fee !== undefined) {
    const rawValue = settings.alias_commission_fee

    // Sanity check: if value is already < 1, it's likely already a fraction
    // (e.g., someone stored 0.095 instead of 9.5). Warn but proceed.
    if (rawValue > 0 && rawValue < 1) {
      console.warn(
        `[buildFeeProfile] alias_commission_fee=${rawValue} looks like a fraction. ` +
        `Expected percentage (e.g., 9.5). Using as-is without /100 conversion.`
      )
      aliasCommissionFee = rawValue
    } else {
      aliasCommissionFee = rawValue / 100
    }
  }

  // Clamp seller level to valid range
  const rawLevel = settings.stockx_seller_level ?? 1
  const stockxSellerLevel = clampSellerLevel(rawLevel)

  return {
    stockxSellerLevel,
    stockxShippingFee: settings.stockx_shipping_fee ?? DEFAULT_FEE_PROFILE.stockxShippingFee,
    aliasCommissionFee,
    aliasSellerRegion: normalizeAliasRegion(settings.alias_region),
    aliasShippingMethod: normalizeAliasMethod(settings.alias_shipping_method),
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Round to 2 decimal places (cents)
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options?: { showSign?: boolean; decimals?: number }
): string {
  const { showSign = false, decimals = 2 } = options ?? {}

  const symbols: Record<Currency, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
  }

  const symbol = symbols[currency]
  const formatted = Math.abs(amount).toFixed(decimals)
  const sign = amount >= 0 ? '+' : '-'

  if (showSign) {
    return `${sign}${symbol}${formatted}`
  }

  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

/**
 * Format percentage for display
 */
export function formatPercent(
  value: number,
  options?: { showSign?: boolean; decimals?: number }
): string {
  const { showSign = false, decimals = 1 } = options ?? {}
  const formatted = Math.abs(value).toFixed(decimals)
  const sign = value >= 0 ? '+' : '-'

  if (showSign) {
    return `${sign}${formatted}%`
  }

  return `${formatted}%`
}
