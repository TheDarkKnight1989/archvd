'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export type Currency = 'GBP' | 'EUR' | 'USD'

export interface FxRates {
  // GBP is the base currency (all prices stored in GBP in database)
  usd_per_gbp: number  // How many USD per 1 GBP
  eur_per_gbp: number  // How many EUR per 1 GBP
  gbp_per_usd: number  // How many GBP per 1 USD (auto-calculated)
  gbp_per_eur: number  // How many GBP per 1 EUR (auto-calculated)
  usd_per_eur: number  // How many USD per 1 EUR (auto-calculated)
  eur_per_usd: number  // How many EUR per 1 USD (auto-calculated)
  as_of: string
}

export interface CurrencyContext {
  currency: Currency
  fxRates: FxRates | null
  loading: boolean
  setCurrency: (currency: Currency) => Promise<void>
  convert: (amount: number, fromCurrency: Currency, toCurrency?: Currency) => number
  format: (amount: number, currency?: Currency) => string
  symbol: (currency?: Currency) => string
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
}

const DEFAULT_FX_RATES: FxRates = {
  usd_per_gbp: 1.27,
  eur_per_gbp: 1.18,
  gbp_per_usd: 0.79,
  gbp_per_eur: 0.85,
  usd_per_eur: 1.08,
  eur_per_usd: 0.93,
  as_of: new Date().toISOString(),
}

/**
 * Currency hook with FX normalization
 *
 * Manages user currency preference and provides helpers for conversion and formatting
 *
 * @example
 * const { currency, convert, format } = useCurrency()
 * const priceInUserCurrency = convert(100, 'GBP')
 * const formatted = format(priceInUserCurrency)
 */
export function useCurrency(): CurrencyContext {
  const [currency, setCurrencyState] = useState<Currency>('GBP')
  const [fxRates, setFxRates] = useState<FxRates | null>(DEFAULT_FX_RATES)
  const [loading, setLoading] = useState(true)

  // Load user preference and FX rates
  useEffect(() => {
    async function loadPreferences() {
      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch user's currency preference
        const { data: profile } = await supabase
          .from('profiles')
          .select('currency_pref')
          .eq('id', user.id)
          .single()

        if (profile?.currency_pref) {
          setCurrencyState(profile.currency_pref as Currency)
        }

        // Fetch latest FX rates
        const { data: rates } = await supabase
          .from('fx_rates')
          .select('*')
          .order('as_of', { ascending: false })
          .limit(1)
          .single()

        if (rates) {
          const usdPerGbp = parseFloat(rates.usd_per_gbp)
          const eurPerGbp = parseFloat(rates.eur_per_gbp)

          setFxRates({
            usd_per_gbp: usdPerGbp,
            eur_per_gbp: eurPerGbp,
            gbp_per_usd: 1.0 / usdPerGbp,
            gbp_per_eur: 1.0 / eurPerGbp,
            usd_per_eur: usdPerGbp / eurPerGbp,
            eur_per_usd: eurPerGbp / usdPerGbp,
            as_of: rates.as_of,
          })
        }
      } catch (error) {
        console.error('[useCurrency] Failed to load preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [])

  // Update user currency preference
  const setCurrency = useCallback(async (newCurrency: Currency) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      // Update in database
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          currency_pref: newCurrency,
        })

      if (error) throw error

      // Update local state
      setCurrencyState(newCurrency)
    } catch (error) {
      console.error('[useCurrency] Failed to update currency:', error)
      throw error
    }
  }, [])

  // Convert amount from one currency to another
  const convert = useCallback(
    (amount: number, fromCurrency: Currency, toCurrency?: Currency): number => {
      const targetCurrency = toCurrency || currency

      if (fromCurrency === targetCurrency || !fxRates) {
        return amount
      }

      // GBP conversions
      if (fromCurrency === 'GBP' && targetCurrency === 'EUR') {
        return amount * fxRates.eur_per_gbp
      }
      if (fromCurrency === 'GBP' && targetCurrency === 'USD') {
        return amount * fxRates.usd_per_gbp
      }

      // EUR conversions
      if (fromCurrency === 'EUR' && targetCurrency === 'GBP') {
        return amount * fxRates.gbp_per_eur
      }
      if (fromCurrency === 'EUR' && targetCurrency === 'USD') {
        return amount * fxRates.usd_per_eur
      }

      // USD conversions
      if (fromCurrency === 'USD' && targetCurrency === 'GBP') {
        return amount * fxRates.gbp_per_usd
      }
      if (fromCurrency === 'USD' && targetCurrency === 'EUR') {
        return amount * fxRates.eur_per_usd
      }

      return amount
    },
    [currency, fxRates]
  )

  // Format amount with currency symbol
  const format = useCallback(
    (amount: number, currencyOverride?: Currency): string => {
      const targetCurrency = currencyOverride || currency
      const formatter = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: targetCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      return formatter.format(amount)
    },
    [currency]
  )

  // Get currency symbol
  const symbol = useCallback(
    (currencyOverride?: Currency): string => {
      const targetCurrency = currencyOverride || currency
      return CURRENCY_SYMBOLS[targetCurrency]
    },
    [currency]
  )

  return {
    currency,
    fxRates,
    loading,
    setCurrency,
    convert,
    format,
    symbol,
  }
}
