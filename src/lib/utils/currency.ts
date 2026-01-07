/**
 * Currency Utilities
 *
 * Helper functions for currency conversion and formatting
 */

export type Currency = 'GBP' | 'EUR' | 'USD' | 'CAD' | 'AUD' | 'JPY'

/**
 * Full FX rates interface matching the database fx_rates table
 */
export interface FxRates {
  gbp_per_eur: number
  eur_per_gbp: number
  gbp_per_usd: number
  usd_per_gbp: number
  // Derived rates (calculated)
  eur_per_usd?: number
  usd_per_eur?: number
}

/**
 * Default FX rates (fallback when database unavailable)
 * These should be updated periodically or fetched from API
 */
export const DEFAULT_FX_RATES: FxRates = {
  gbp_per_eur: 0.836,
  eur_per_gbp: 1.196,
  gbp_per_usd: 0.796,
  usd_per_gbp: 1.256,
  eur_per_usd: 0.95,  // ~0.836 / 0.796 * 0.9
  usd_per_eur: 1.05,
}

/**
 * Legacy GBP formatter (for backwards compatibility)
 */
export function formatGBP(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

/**
 * Convert amount from one currency to another
 * Supports GBP, EUR, USD conversions
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  fxRates: FxRates
): number {
  if (fromCurrency === toCurrency) {
    return amount
  }

  // Direct conversions
  if (fromCurrency === 'GBP' && toCurrency === 'EUR') {
    return amount * fxRates.eur_per_gbp
  }
  if (fromCurrency === 'EUR' && toCurrency === 'GBP') {
    return amount * fxRates.gbp_per_eur
  }
  if (fromCurrency === 'GBP' && toCurrency === 'USD') {
    return amount * fxRates.usd_per_gbp
  }
  if (fromCurrency === 'USD' && toCurrency === 'GBP') {
    return amount * fxRates.gbp_per_usd
  }

  // EUR <-> USD (via GBP or direct if available)
  if (fromCurrency === 'EUR' && toCurrency === 'USD') {
    if (fxRates.usd_per_eur) {
      return amount * fxRates.usd_per_eur
    }
    // Convert EUR -> GBP -> USD
    const gbp = amount * fxRates.gbp_per_eur
    return gbp * fxRates.usd_per_gbp
  }
  if (fromCurrency === 'USD' && toCurrency === 'EUR') {
    if (fxRates.eur_per_usd) {
      return amount * fxRates.eur_per_usd
    }
    // Convert USD -> GBP -> EUR
    const gbp = amount * fxRates.gbp_per_usd
    return gbp * fxRates.eur_per_gbp
  }

  // Unsupported currency pair - return original
  return amount
}

/**
 * Convert amount to a target currency from a source currency
 * Convenience wrapper with null handling
 */
export function convertToTargetCurrency(
  amount: number | null | undefined,
  fromCurrency: Currency,
  toCurrency: Currency,
  fxRates: FxRates
): number | null {
  if (amount == null) return null
  return convertCurrency(amount, fromCurrency, toCurrency, fxRates)
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number | null | undefined, currency: Currency = 'GBP'): string {
  if (amount == null) return '—'

  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return formatter.format(amount)
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    GBP: '£',
    EUR: '€',
    USD: '$',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
  }

  return symbols[currency]
}

export const SUPPORTED_CURRENCIES: Record<Currency, { symbol: string; name: string; flag: string }> = {
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
}

/**
 * Parse currency value from string
 */
export function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) {
    return null
  }

  return parsed
}
