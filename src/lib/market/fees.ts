/**
 * Market Fee Configurations
 * WHY: Single source of truth for platform selling fees
 */

/**
 * Get StockX seller fee percentage
 * Default: 10% (0.10)
 * Override via MARKET_FEE_STOCKX_PCT environment variable
 */
export function stockxSellerFeePct(): number {
  const v = Number(process.env.MARKET_FEE_STOCKX_PCT)
  return Number.isFinite(v) && v >= 0 && v < 1 ? v : 0.10
}

/**
 * Calculate net payout after StockX fees
 * @param grossAmount - The gross sale amount (highest bid)
 * @returns Net amount after fees, rounded to 2 decimal places
 */
export function calculateStockxNetPayout(grossAmount: number): number {
  const feePct = stockxSellerFeePct()
  const net = grossAmount * (1 - feePct)
  return Math.round(net * 100) / 100
}
