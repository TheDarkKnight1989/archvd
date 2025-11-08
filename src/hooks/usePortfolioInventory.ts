'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { InventoryItem } from './useInventory'

export type EnrichedInventoryItem = InventoryItem & {
  // Computed fields
  invested: number
  profit: number | null
  performance_pct: number | null
  market_source: string

  // Enriched data
  image_url?: string
  full_title: string
  sparkline_data: { date: string; value: number }[]
}

export function usePortfolioInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('Inventory')
        .select('*')
        .in('status', ['active', 'listed', 'worn'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(data || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch items')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  // Enrich items with computed fields
  const enrichedItems: EnrichedInventoryItem[] = useMemo(() => {
    return items.map((item) => {
      // Calculate invested (buy + tax + ship)
      const invested = item.purchase_total || (
        item.purchase_price +
        (item.tax || 0) +
        (item.shipping || 0)
      )

      // Calculate profit: (sold_price || market_value) - invested
      const currentValue = item.sold_price || item.market_value
      const profit = currentValue !== null && currentValue !== undefined
        ? currentValue - invested
        : null

      // Calculate performance %: profit / invested
      const performance_pct = profit !== null && invested > 0
        ? profit / invested
        : null

      // Get market source from meta
      const market_source = item.market_meta?.sources_used?.[0] || '-'

      // Build full title
      const full_title = [item.brand, item.model, item.colorway]
        .filter(Boolean)
        .join(' • ')

      // Generate sparkline data (mock for now - can be enhanced with real time series)
      const sparkline_data = generateMockSparkline(
        item.market_value || item.purchase_price,
        14
      )

      return {
        ...item,
        invested,
        profit,
        performance_pct,
        market_source,
        full_title,
        sparkline_data,
      }
    })
  }, [items])

  return {
    items: enrichedItems,
    loading,
    error,
    refetch: fetchItems,
  }
}

// Generate mock sparkline data (14 days)
function generateMockSparkline(
  currentPrice: number,
  days: number
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = []
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * dayMs)
    // Add slight random variation (±5%)
    const variation = 0.95 + Math.random() * 0.1
    const value = currentPrice * variation

    data.push({
      date: date.toISOString(),
      value: Math.max(0, value),
    })
  }

  return data
}
