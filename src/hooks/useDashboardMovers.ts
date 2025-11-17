'use client'

import { useMemo } from 'react'
import { usePortfolioInventory, type EnrichedInventoryItem } from './usePortfolioInventory'

export type SortBy = 'performance' | 'market_value' | 'quantity'

export interface Mover {
  id: string
  sku: string
  brand: string
  model: string
  colorway?: string
  size: string
  image_url?: string
  market_value: number
  invested: number
  profit: number
  performance_pct: number
  market_source: string
  price_as_of?: string
}

export function useDashboardMovers(sortBy: SortBy = 'performance', limit: number = 15) {
  const { items, loading, error } = usePortfolioInventory()

  const movers = useMemo(() => {
    if (!items || items.length === 0) return []

    // Filter active items with valid market data
    const activeWithPrices = items.filter((item) => {
      return (
        item.status === 'active' &&
        item.market_value != null &&
        item.market_value > 0 &&
        item.performance_pct != null
      )
    })

    // Sort by selected criteria
    const sorted = [...activeWithPrices].sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return (b.performance_pct || 0) - (a.performance_pct || 0) // Highest % gain first
        case 'market_value':
          return (b.market_value || 0) - (a.market_value || 0) // Highest value first
        case 'quantity':
          // For quantity, we'd need to group by SKU and count, but for now just use performance
          return (b.performance_pct || 0) - (a.performance_pct || 0)
        default:
          return 0
      }
    })

    // Take top N
    return sorted.slice(0, limit).map(
      (item): Mover => ({
        id: item.id,
        sku: item.sku,
        brand: item.brand || 'Unknown',
        model: item.model || '',
        colorway: item.colorway || undefined,
        size: item.size || '',
        image_url: item.image_url || undefined,
        market_value: item.market_value || 0,
        invested: item.invested || 0,
        profit: item.profit || 0,
        performance_pct: item.performance_pct || 0,
        market_source: item.market_source || 'unknown',
        price_as_of: item.stockx_price_as_of || undefined,
      })
    )
  }, [items, sortBy, limit])

  return { movers, loading, error }
}
