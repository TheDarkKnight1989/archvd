/**
 * Hook for managing user settings
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

// ============================================================================
// Region Constants & Types
// ============================================================================

/** EU country codes that map to region 2 / EUR */
const EU_REGIONS = ['de', 'nl', 'fr', 'at', 'be', 'it', 'es'] as const

/** Valid alias_region values (country codes) */
export type AliasRegion = 'uk' | 'gb' | 'us' | (typeof EU_REGIONS)[number]

/** RPC region IDs: '1'=UK, '2'=EU, '3'=US */
export type AliasRegionId = '1' | '2' | '3'

/** StockX currency codes */
export type StockxCurrency = 'GBP' | 'EUR' | 'USD'

// ============================================================================
// User Settings Interface
// ============================================================================

export interface UserSettings {
  id: string
  user_id: string
  stockx_seller_level: number
  stockx_shipping_fee: number
  currency_preference: string
  timezone: string
  created_at: string
  updated_at: string
  // Alias settings
  alias_region?: AliasRegion
  alias_shipping_method?: string
}

// ============================================================================
// Region Mapping Helpers
// ============================================================================

/**
 * Map user's alias_region setting to RPC region ID
 * Based on testing: '1'=UK, '2'=EU, '3'=US
 */
export function getAliasRegionId(userRegion?: string): AliasRegionId {
  if (!userRegion) return '1' // Default to UK

  const region = userRegion.toLowerCase()

  // UK
  if (region === 'uk' || region === 'gb') {
    return '1'
  }

  // EU countries → region 2
  if (EU_REGIONS.includes(region as (typeof EU_REGIONS)[number])) {
    return '2'
  }

  // US
  if (region === 'us') {
    return '3'
  }

  // Default to UK
  return '1'
}

/**
 * Map user's alias_region setting to StockX currency code
 * Matches the regional pricing that StockX uses
 */
export function getStockxCurrency(userRegion?: string): StockxCurrency {
  if (!userRegion) return 'GBP' // Default to UK

  const region = userRegion.toLowerCase()

  // UK → GBP
  if (region === 'uk' || region === 'gb') {
    return 'GBP'
  }

  // EU countries → EUR
  if (EU_REGIONS.includes(region as (typeof EU_REGIONS)[number])) {
    return 'EUR'
  }

  // US → USD
  if (region === 'us') {
    return 'USD'
  }

  // Default to GBP
  return 'GBP'
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/user/settings')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }

      const data = await response.json()
      setSettings(data)
    } catch (err: any) {
      console.error('[useUserSettings] Error fetching settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    try {
      setError(null)

      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update settings')
      }

      const data = await response.json()
      setSettings(data)
      return data
    } catch (err: any) {
      console.error('[useUserSettings] Error updating settings:', err)
      setError(err.message)
      throw err
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Derived values: pre-computed region/currency mappings
  // Saves callers from needing to import and call the helper functions
  const aliasRegionId = useMemo(
    () => getAliasRegionId(settings?.alias_region),
    [settings?.alias_region]
  )

  const stockxCurrency = useMemo(
    () => getStockxCurrency(settings?.alias_region),
    [settings?.alias_region]
  )

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
    // Derived values for convenience
    aliasRegionId,
    stockxCurrency,
  }
}
