/**
 * Foreign Exchange Utilities
 * FX rate calculations and currency conversions
 */

import { db } from './db'

export type Currency = 'GBP' | 'EUR' | 'USD'

export const SUPPORTED_CURRENCIES: Currency[] = ['GBP', 'EUR', 'USD']

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$'
}

export const CURRENCY_NAMES: Record<Currency, string> = {
  GBP: 'British Pound',
  EUR: 'Euro',
  USD: 'US Dollar'
}

/**
 * Convert amount from one currency to another at a specific date
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  date: string = new Date().toISOString().split('T')[0]
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount
  }

  const rate = await db.getFxRate(date, fromCurrency, toCurrency)
  return amount * rate
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options?: {
    showSymbol?: boolean
    decimals?: number
    showCode?: boolean
  }
): string {
  const {
    showSymbol = true,
    decimals = 2,
    showCode = false
  } = options ?? {}

  const formatted = amount.toFixed(decimals)
  const parts: string[] = []

  if (showSymbol) {
    parts.push(CURRENCY_SYMBOLS[currency])
  }

  parts.push(formatted)

  if (showCode) {
    parts.push(currency)
  }

  return parts.join('')
}

/**
 * Calculate base currency amounts for a transaction
 */
export async function calculateBaseCurrencyAmounts(
  userId: string,
  originalAmount: number,
  originalCurrency: Currency,
  transactionDate: string
): Promise<{
  baseCurrency: Currency
  fxRate: number
  baseAmount: number
}> {
  const baseCurrency = await db.getUserBaseCurrency(userId)
  const fxRate = await db.getFxRate(transactionDate, originalCurrency, baseCurrency)
  const baseAmount = originalAmount * fxRate

  return {
    baseCurrency,
    fxRate,
    baseAmount
  }
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): code is Currency {
  return SUPPORTED_CURRENCIES.includes(code as Currency)
}

/**
 * Get currency from code with validation
 */
export function parseCurrency(code: string): Currency {
  const upper = code.toUpperCase()
  if (!isValidCurrency(upper)) {
    throw new Error(`Invalid currency code: ${code}`)
  }
  return upper
}

/**
 * FX snapshot for storing with transactions
 */
export interface FxSnapshot {
  originalCurrency: Currency
  originalAmount: number
  baseCurrency: Currency
  fxRate: number
  baseAmount: number
  fxDate: string
  fxSource: 'auto' | 'manual'
}

/**
 * Create FX snapshot for a transaction
 */
export async function createFxSnapshot(
  userId: string,
  originalAmount: number,
  originalCurrency: Currency,
  transactionDate: string,
  fxSource: 'auto' | 'manual' = 'auto'
): Promise<FxSnapshot> {
  const { baseCurrency, fxRate, baseAmount } = await calculateBaseCurrencyAmounts(
    userId,
    originalAmount,
    originalCurrency,
    transactionDate
  )

  return {
    originalCurrency,
    originalAmount,
    baseCurrency,
    fxRate,
    baseAmount,
    fxDate: transactionDate,
    fxSource
  }
}
