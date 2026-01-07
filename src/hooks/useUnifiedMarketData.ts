'use client'

/**
 * useUnifiedMarketData Hook
 *
 * React hook for fetching combined StockX + Alias market data.
 * Provides loading states, error handling, and automatic refetch on param changes.
 *
 * IMPORTANT - Currency Handling:
 *   Returns prices in NATIVE currencies (StockX: GBP, Alias: USD).
 *   Before comparing prices across providers, convert to same currency using `useCurrency` hook:
 *   ```ts
 *   const { convert } = useCurrency()
 *   const stockxInUSD = convert(row.stockx_lowest_ask, 'GBP', 'USD')
 *   const aliasInUSD = row.alias_lowest_ask // already USD
 *   const bestAsk = Math.min(stockxInUSD, aliasInUSD)
 *   ```
 *
 * @example
 * const { data, loading, error, refetch } = useUnifiedMarketData({
 *   styleId: 'DD1391-100',
 *   aliasRegion: '1', // UK
 * })
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  getUnifiedMarketData,
  getUnifiedMarketDataDirect,
  type UnifiedMarketRow,
  type AliasRegion,
} from '@/lib/services/unified-market'

export interface UseUnifiedMarketDataOptions {
  styleId: string | null
  aliasRegion?: AliasRegion
  consigned?: boolean
  enabled?: boolean // Set to false to disable auto-fetch
  useDirect?: boolean // Use direct query instead of RPC (for pre-migration testing)
}

export interface UseUnifiedMarketDataResult {
  data: UnifiedMarketRow[] | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useUnifiedMarketData(
  options: UseUnifiedMarketDataOptions
): UseUnifiedMarketDataResult {
  const {
    styleId,
    aliasRegion = '1',
    consigned = false,
    enabled = true,
    useDirect = false,
  } = options

  const [data, setData] = useState<UnifiedMarketRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!styleId || !enabled) {
      setData(null)
      setError(null) // Clear stale errors when disabled/no SKU
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use direct query or RPC based on option
      const fetchFn = useDirect ? getUnifiedMarketDataDirect : getUnifiedMarketData

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await fetchFn(supabase as any, {
        styleId,
        aliasRegion,
        consigned,
      })

      if (result.error) {
        // If RPC fails, fallback to direct query
        if (!useDirect) {
          console.warn('[useUnifiedMarketData] RPC failed, trying direct query')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const directResult = await getUnifiedMarketDataDirect(supabase as any, {
            styleId,
            aliasRegion,
            consigned,
          })

          if (directResult.error) {
            setError(directResult.error)
            setData(null)
          } else {
            setData(directResult.data)
          }
        } else {
          setError(result.error)
          setData(null)
        }
      } else {
        setData(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [styleId, aliasRegion, consigned, enabled, useDirect])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

/**
 * Helper to find best price across providers
 * Requires prices to be in the same currency (do FX conversion first)
 */
export function findBestAsk(row: UnifiedMarketRow): {
  provider: 'stockx' | 'alias' | null
  price: number | null
} {
  const stockxAsk = row.stockx_lowest_ask
  const aliasAsk = row.alias_lowest_ask

  if (stockxAsk === null && aliasAsk === null) {
    return { provider: null, price: null }
  }

  if (stockxAsk === null) {
    return { provider: 'alias', price: aliasAsk }
  }

  if (aliasAsk === null) {
    return { provider: 'stockx', price: stockxAsk }
  }

  // Both have prices - compare (assumes same currency after FX)
  if (stockxAsk <= aliasAsk) {
    return { provider: 'stockx', price: stockxAsk }
  } else {
    return { provider: 'alias', price: aliasAsk }
  }
}

/**
 * Helper to find best bid across providers
 * Requires prices to be in the same currency (do FX conversion first)
 */
export function findBestBid(row: UnifiedMarketRow): {
  provider: 'stockx' | 'alias' | null
  price: number | null
} {
  const stockxBid = row.stockx_highest_bid
  const aliasBid = row.alias_highest_bid

  if (stockxBid === null && aliasBid === null) {
    return { provider: null, price: null }
  }

  if (stockxBid === null) {
    return { provider: 'alias', price: aliasBid }
  }

  if (aliasBid === null) {
    return { provider: 'stockx', price: stockxBid }
  }

  // Both have bids - higher is better for seller
  if (stockxBid >= aliasBid) {
    return { provider: 'stockx', price: stockxBid }
  } else {
    return { provider: 'alias', price: aliasBid }
  }
}
