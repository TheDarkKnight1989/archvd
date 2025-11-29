/**
 * Region utilities for mapping currency to StockX/Alias regions
 */

import type { Currency } from '@/hooks/useCurrency'

export type Region = 'UK' | 'EU' | 'US'

/**
 * Map currency to region
 *
 * GBP → UK
 * EUR → EU
 * USD → US
 */
export function currencyToRegion(currency: Currency): Region {
  const mapping: Record<Currency, Region> = {
    GBP: 'UK',
    EUR: 'EU',
    USD: 'US',
  }

  return mapping[currency]
}

/**
 * Map region to currency
 *
 * UK → GBP
 * EU → EUR
 * US → USD
 */
export function regionToCurrency(region: Region): Currency {
  const mapping: Record<Region, Currency> = {
    UK: 'GBP',
    EU: 'EUR',
    US: 'USD',
  }

  return mapping[region]
}

/**
 * Get StockX country code for region
 *
 * Used for StockX API calls
 */
export function getStockxCountryCode(region: Region): string {
  const mapping: Record<Region, string> = {
    UK: 'GB',
    EU: 'DE', // Use Germany as representative EU country for StockX
    US: 'US',
  }

  return mapping[region]
}

/**
 * Get Alias region code
 *
 * Used for Alias API calls
 */
export function getAliasRegion(region: Region): string {
  const mapping: Record<Region, string> = {
    UK: 'uk',
    EU: 'eu',
    US: 'us',
  }

  return mapping[region]
}
