/**
 * Currency Utilities
 *
 * Helper functions for currency conversion and formatting
 */

export type Currency = 'GBP' | 'EUR' | 'USD' | 'CAD' | 'AUD' | 'JPY'

export interface FxRates {
  gbp_per_eur: number
  eur_per_gbp: number
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

  if (fromCurrency === 'GBP' && toCurrency === 'EUR') {
    return amount * fxRates.eur_per_gbp
  }

  if (fromCurrency === 'EUR' && toCurrency === 'GBP') {
    return amount * fxRates.gbp_per_eur
  }

  return amount
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
