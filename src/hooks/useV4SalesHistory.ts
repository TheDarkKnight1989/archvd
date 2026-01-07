'use client'

/**
 * useV4SalesHistory Hook
 *
 * Fetches sales data from V4 tables:
 * - Raw sales (90 days): inventory_v4_alias_sales_history
 * - Daily aggregates (13 months): inventory_v4_alias_sales_daily
 * - Monthly aggregates (all-time): inventory_v4_alias_sales_monthly
 *
 * V4 Tables:
 * - inventory_v4_style_catalog (to get alias_catalog_id)
 * - inventory_v4_alias_sales_history
 * - inventory_v4_alias_sales_daily
 * - inventory_v4_alias_sales_monthly
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

// Raw sale row from inventory_v4_alias_sales_history
export interface RawSale {
  purchased_at: string
  price: number
  size_value: number
  consigned: boolean | null
}

// Daily aggregate row from inventory_v4_alias_sales_daily
export interface DailySale {
  sale_date: string
  size_value: number
  sale_count: number
  total_revenue: number
  avg_price: number
  min_price: number
  max_price: number
  consigned_count: number
  non_consigned_count: number
}

// Monthly aggregate row from inventory_v4_alias_sales_monthly
export interface MonthlySale {
  sale_month: string
  size_value: number
  sale_count: number
  total_revenue: number
  avg_price: number
  min_price: number
  max_price: number
  consigned_count: number
  non_consigned_count: number
}

// Aggregated chart point (for time series)
export interface SalesChartPoint {
  date: string
  totalSales: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  volume: number // total revenue
}

// Liquidity metrics
export interface LiquidityMetrics {
  salesLast72h: number
  salesLast30d: number
  avgDailySales30d: number
  mostActiveSizes: Array<{ size: number; count: number }>
}

export interface UseV4SalesHistoryOptions {
  styleId: string | null
  sizeFilter?: number | null // Filter by specific size
  enabled?: boolean
}

export interface UseV4SalesHistoryResult {
  // Raw data (90 days)
  rawSales: RawSale[] | null
  rawSalesLoading: boolean
  rawSalesError: Error | null

  // Daily aggregates (13 months)
  dailySales: DailySale[] | null
  dailySalesLoading: boolean
  dailySalesError: Error | null

  // Monthly aggregates (all time)
  monthlySales: MonthlySale[] | null
  monthlySalesLoading: boolean
  monthlySalesError: Error | null

  // Derived data
  rawSalesChart: SalesChartPoint[] | null
  dailySalesChart: SalesChartPoint[] | null
  monthlySalesChart: SalesChartPoint[] | null
  liquidity: LiquidityMetrics | null

  // Actions
  refetch: () => Promise<void>
}

export function useV4SalesHistory(
  options: UseV4SalesHistoryOptions
): UseV4SalesHistoryResult {
  const { styleId, sizeFilter = null, enabled = true } = options

  // State - catalog lookup
  const [aliasCatalogId, setAliasCatalogId] = useState<string | null>(null)

  // State - raw sales
  const [rawSales, setRawSales] = useState<RawSale[] | null>(null)
  const [rawSalesLoading, setRawSalesLoading] = useState(false)
  const [rawSalesError, setRawSalesError] = useState<Error | null>(null)

  // State - daily sales
  const [dailySales, setDailySales] = useState<DailySale[] | null>(null)
  const [dailySalesLoading, setDailySalesLoading] = useState(false)
  const [dailySalesError, setDailySalesError] = useState<Error | null>(null)

  // State - monthly sales
  const [monthlySales, setMonthlySales] = useState<MonthlySale[] | null>(null)
  const [monthlySalesLoading, setMonthlySalesLoading] = useState(false)
  const [monthlySalesError, setMonthlySalesError] = useState<Error | null>(null)

  // Lookup alias_catalog_id from style_catalog
  const fetchCatalogId = useCallback(async () => {
    if (!styleId || !enabled) {
      setAliasCatalogId(null)
      return null
    }

    const { data, error } = await supabase
      .from('inventory_v4_style_catalog')
      .select('alias_catalog_id')
      .eq('style_id', styleId)
      .maybeSingle()

    if (error) {
      console.error('[useV4SalesHistory] Failed to lookup catalog:', error)
      return null
    }

    const catalogId = data?.alias_catalog_id || null
    setAliasCatalogId(catalogId)
    return catalogId
  }, [styleId, enabled])

  // Fetch raw sales (90 days)
  const fetchRawSales = useCallback(
    async (catalogId: string) => {
      setRawSalesLoading(true)
      setRawSalesError(null)

      try {
        const ninetyDaysAgo = new Date(
          Date.now() - 90 * 24 * 60 * 60 * 1000
        ).toISOString()

        let query = supabase
          .from('inventory_v4_alias_sales_history')
          .select('purchased_at, price, size_value, consigned')
          .eq('alias_catalog_id', catalogId)
          .gte('purchased_at', ninetyDaysAgo)
          .order('purchased_at', { ascending: true })

        if (sizeFilter !== null) {
          query = query.eq('size_value', sizeFilter)
        }

        const { data, error } = await query.limit(10000)

        if (error) throw error
        setRawSales(data as RawSale[])
      } catch (err) {
        setRawSalesError(
          err instanceof Error ? err : new Error(String(err))
        )
        setRawSales(null)
      } finally {
        setRawSalesLoading(false)
      }
    },
    [sizeFilter]
  )

  // Fetch daily aggregates (13 months)
  const fetchDailySales = useCallback(
    async (catalogId: string) => {
      setDailySalesLoading(true)
      setDailySalesError(null)

      try {
        let query = supabase
          .from('inventory_v4_alias_sales_daily')
          .select(
            'sale_date, size_value, sale_count, total_revenue, avg_price, min_price, max_price, consigned_count, non_consigned_count'
          )
          .eq('alias_catalog_id', catalogId)
          .order('sale_date', { ascending: true })

        if (sizeFilter !== null) {
          query = query.eq('size_value', sizeFilter)
        }

        const { data, error } = await query.limit(10000)

        if (error) throw error
        setDailySales(data as DailySale[])
      } catch (err) {
        setDailySalesError(
          err instanceof Error ? err : new Error(String(err))
        )
        setDailySales(null)
      } finally {
        setDailySalesLoading(false)
      }
    },
    [sizeFilter]
  )

  // Fetch monthly aggregates (all time)
  const fetchMonthlySales = useCallback(
    async (catalogId: string) => {
      setMonthlySalesLoading(true)
      setMonthlySalesError(null)

      try {
        let query = supabase
          .from('inventory_v4_alias_sales_monthly')
          .select(
            'sale_month, size_value, sale_count, total_revenue, avg_price, min_price, max_price, consigned_count, non_consigned_count'
          )
          .eq('alias_catalog_id', catalogId)
          .order('sale_month', { ascending: true })

        if (sizeFilter !== null) {
          query = query.eq('size_value', sizeFilter)
        }

        const { data, error } = await query.limit(1000)

        if (error) throw error
        setMonthlySales(data as MonthlySale[])
      } catch (err) {
        setMonthlySalesError(
          err instanceof Error ? err : new Error(String(err))
        )
        setMonthlySales(null)
      } finally {
        setMonthlySalesLoading(false)
      }
    },
    [sizeFilter]
  )

  // Main fetch function
  const fetchAll = useCallback(async () => {
    const catalogId = await fetchCatalogId()
    if (!catalogId) {
      setRawSales(null)
      setDailySales(null)
      setMonthlySales(null)
      return
    }

    // Fetch all three in parallel
    await Promise.all([
      fetchRawSales(catalogId),
      fetchDailySales(catalogId),
      fetchMonthlySales(catalogId),
    ])
  }, [fetchCatalogId, fetchRawSales, fetchDailySales, fetchMonthlySales])

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (enabled && styleId) {
      fetchAll()
    }
  }, [enabled, styleId, fetchAll])

  // Derive chart data from raw sales (aggregate by day)
  const rawSalesChart = useMemo<SalesChartPoint[] | null>(() => {
    if (!rawSales || rawSales.length === 0) return null

    const byDay = new Map<
      string,
      { prices: number[]; count: number; volume: number }
    >()

    for (const sale of rawSales) {
      const day = sale.purchased_at.slice(0, 10) // YYYY-MM-DD
      const existing = byDay.get(day) || { prices: [], count: 0, volume: 0 }
      existing.prices.push(sale.price)
      existing.count += 1
      existing.volume += sale.price
      byDay.set(day, existing)
    }

    return Array.from(byDay.entries())
      .map(([date, data]) => ({
        date,
        totalSales: data.count,
        avgPrice: Math.round(
          data.prices.reduce((a, b) => a + b, 0) / data.prices.length
        ),
        minPrice: Math.min(...data.prices),
        maxPrice: Math.max(...data.prices),
        volume: Math.round(data.volume),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [rawSales])

  // Derive chart data from daily aggregates (aggregate across sizes per day)
  const dailySalesChart = useMemo<SalesChartPoint[] | null>(() => {
    if (!dailySales || dailySales.length === 0) return null

    const byDay = new Map<
      string,
      {
        count: number
        volume: number
        minPrice: number
        maxPrice: number
        avgWeighted: number
      }
    >()

    for (const row of dailySales) {
      const day = row.sale_date.slice(0, 10)
      const existing = byDay.get(day) || {
        count: 0,
        volume: 0,
        minPrice: Infinity,
        maxPrice: -Infinity,
        avgWeighted: 0,
      }
      existing.count += row.sale_count
      existing.volume += row.total_revenue
      existing.minPrice = Math.min(existing.minPrice, row.min_price)
      existing.maxPrice = Math.max(existing.maxPrice, row.max_price)
      byDay.set(day, existing)
    }

    return Array.from(byDay.entries())
      .map(([date, data]) => ({
        date,
        totalSales: data.count,
        avgPrice: Math.round(data.volume / data.count),
        minPrice: data.minPrice === Infinity ? 0 : data.minPrice,
        maxPrice: data.maxPrice === -Infinity ? 0 : data.maxPrice,
        volume: Math.round(data.volume),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dailySales])

  // Derive chart data from monthly aggregates
  const monthlySalesChart = useMemo<SalesChartPoint[] | null>(() => {
    if (!monthlySales || monthlySales.length === 0) return null

    const byMonth = new Map<
      string,
      {
        count: number
        volume: number
        minPrice: number
        maxPrice: number
      }
    >()

    for (const row of monthlySales) {
      const month = row.sale_month.slice(0, 7) // YYYY-MM
      const existing = byMonth.get(month) || {
        count: 0,
        volume: 0,
        minPrice: Infinity,
        maxPrice: -Infinity,
      }
      existing.count += row.sale_count
      existing.volume += row.total_revenue
      existing.minPrice = Math.min(existing.minPrice, row.min_price)
      existing.maxPrice = Math.max(existing.maxPrice, row.max_price)
      byMonth.set(month, existing)
    }

    return Array.from(byMonth.entries())
      .map(([date, data]) => ({
        date,
        totalSales: data.count,
        avgPrice: Math.round(data.volume / data.count),
        minPrice: data.minPrice === Infinity ? 0 : data.minPrice,
        maxPrice: data.maxPrice === -Infinity ? 0 : data.maxPrice,
        volume: Math.round(data.volume),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [monthlySales])

  // Derive liquidity metrics
  const liquidity = useMemo<LiquidityMetrics | null>(() => {
    if (!rawSales || rawSales.length === 0) return null

    const now = Date.now()
    const h72Ago = now - 72 * 60 * 60 * 1000
    const d30Ago = now - 30 * 24 * 60 * 60 * 1000

    let sales72h = 0
    let sales30d = 0
    const sizeCounts = new Map<number, number>()

    for (const sale of rawSales) {
      const saleTime = new Date(sale.purchased_at).getTime()

      if (saleTime >= h72Ago) sales72h++
      if (saleTime >= d30Ago) sales30d++

      // Count by size (for last 30d)
      if (saleTime >= d30Ago) {
        sizeCounts.set(sale.size_value, (sizeCounts.get(sale.size_value) || 0) + 1)
      }
    }

    // Top 5 most active sizes
    const mostActiveSizes = Array.from(sizeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([size, count]) => ({ size, count }))

    return {
      salesLast72h: sales72h,
      salesLast30d: sales30d,
      avgDailySales30d: Math.round((sales30d / 30) * 10) / 10,
      mostActiveSizes,
    }
  }, [rawSales])

  return {
    rawSales,
    rawSalesLoading,
    rawSalesError,
    dailySales,
    dailySalesLoading,
    dailySalesError,
    monthlySales,
    monthlySalesLoading,
    monthlySalesError,
    rawSalesChart,
    dailySalesChart,
    monthlySalesChart,
    liquidity,
    refetch: fetchAll,
  }
}
