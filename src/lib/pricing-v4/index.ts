/**
 * ARCHVD V4 Pricing Module
 *
 * Fresh V4 implementation for fee-adjusted pricing.
 * Provides ARCHVD Smart Price with honest profit calculations.
 *
 * CONVENTIONS:
 * - All fee percentages as FRACTIONS (0.09 = 9%)
 * - Cost passed separately from options for cache safety
 * - Size-scoped identity on all prices (styleId + size + sizeUnit)
 */

// Types
export type {
  Currency,
  FxRates,
  Platform,
  StockXSellerLevel,
  FeeProfile,
  PlatformFeeConfig,
  FeeBreakdown,
  PlatformNetProceeds,
  PriceSource,
  PriceConfidence,
  DataFreshness,
  SizeUnit,
  ProviderDataStatus,
  ProviderFreshness,
  ArchvdPriceInputs,
  ArchvdBids,
  ArchvdPrice,
  ArchvdPriceWithFees,
  StockXMarketInput,
  AliasMarketInput,
  UnifiedMarketInput,
  CostInput,
  CalculationOptions,
} from './types'

// Constants
export {
  STOCKX_SELLER_LEVEL_FEES,
  DEFAULT_FEE_PROFILE,
  FRESHNESS_THRESHOLDS,
} from './types'

// Fee calculation
export {
  getPlatformFeeConfig,
  calculateFees,
  calculateNetProceeds,
  convertToUserCurrency,
  getFxRate,
  getBestPlatform,
  calculateRealProfit,
  buildFeeProfile,
  formatCurrency,
  formatPercent,
} from './fees'

// ARCHVD price calculation
export {
  calculateArchvdPrice,
  calculateArchvdPriceWithFees,
  hasMarketData,
  getDataAvailability,
  getProviderStatuses,
  determineDataFreshness,
  getDefaultFxRates,
} from './archvd'
