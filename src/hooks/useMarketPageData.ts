'use client'

/**
 * useMarketPageData Hook
 *
 * Combines all data sources needed for the V4 market page:
 * - Style catalog (product info)
 * - Current market data (StockX + Alias)
 * - Sales history (raw, daily, monthly)
 * - Derived stats (last sale, market price, liquidity)
 *
 * V4 Tables:
 * - inventory_v4_style_catalog
 * - inventory_v4_stockx_market_data (via unified-market)
 * - inventory_v4_alias_market_data (via unified-market)
 * - inventory_v4_alias_sales_history
 * - inventory_v4_alias_sales_daily
 * - inventory_v4_alias_sales_monthly
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { AliasRegion } from '@/lib/services/unified-market'

// Time range options
export type TimeRange = '7D' | '30D' | '90D' | '13M' | 'ALL'

// Chart data point
export interface ChartPoint {
  date: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  volume: number
}

// Key stats
export interface KeyStats {
  lastSale: { price: number; date: string } | null
  lowestAsk: { price: number; provider: 'stockx' | 'alias' } | null
  highestBid: { price: number; provider: 'stockx' | 'alias' } | null
  marketPrice: number | null // 7-day weighted avg
}

// Liquidity metrics
export interface Liquidity {
  sales72h: number
  sales30d: number
  avgDaily: number
}

// Size grid row
export interface SizeGridRow {
  size: string
  sizeNumeric: number | null
  stockxAsk: number | null
  stockxBid: number | null
  aliasAsk: number | null
  aliasBid: number | null
  lastSale: { price: number; date: string } | null
}

// Product info
export interface ProductInfo {
  styleId: string
  name: string | null
  brand: string | null
  colorway: string | null
  imageUrl: string | null
  releaseDate: string | null
  retailPrice: number | null
}

export interface UseMarketPageDataOptions {
  styleId: string | null
  aliasRegion?: AliasRegion
  sizeFilter?: string | null
  enabled?: boolean
}

export type SizeGridTab = 'asks' | 'bids' | 'sales'

export interface UseMarketPageDataResult {
  // Product
  product: ProductInfo | null
  productLoading: boolean

  // Key stats
  keyStats: KeyStats | null
  keyStatsLoading: boolean

  // Chart data
  chartData: ChartPoint[] | null
  chartRange: TimeRange
  setChartRange: (range: TimeRange) => void
  chartLoading: boolean

  // Chart summary
  chartSummary: {
    high: number
    low: number
    avg: number
    volume: number
  } | null

  // Liquidity
  liquidity: Liquidity | null
  liquidityLoading: boolean

  // Size grid
  sizeGrid: SizeGridRow[] | null
  sizeGridLoading: boolean
  sizeGridTab: SizeGridTab
  setSizeGridTab: (tab: SizeGridTab) => void

  // Actions
  refetch: () => Promise<void>
}

export function useMarketPageData(
  options: UseMarketPageDataOptions
): UseMarketPageDataResult {
  const { styleId, aliasRegion = '1', sizeFilter = null, enabled = true } = options

  // State
  const [aliasCatalogId, setAliasCatalogId] = useState<string | null>(null)
  const [stockxProductId, setStockxProductId] = useState<string | null>(null)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [productLoading, setProductLoading] = useState(false)

  const [keyStats, setKeyStats] = useState<KeyStats | null>(null)
  const [keyStatsLoading, setKeyStatsLoading] = useState(false)

  const [chartRange, setChartRange] = useState<TimeRange>('30D')
  const [rawSales, setRawSales] = useState<Array<{ purchased_at: string; price: number; size_value: number }> | null>(null)
  const [dailySales, setDailySales] = useState<Array<{ sale_date: string; avg_price: number; min_price: number; max_price: number; sale_count: number }> | null>(null)
  const [monthlySales, setMonthlySales] = useState<Array<{ sale_month: string; avg_price: number; min_price: number; max_price: number; sale_count: number }> | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const [sizeGrid, setSizeGrid] = useState<SizeGridRow[] | null>(null)
  const [sizeGridLoading, setSizeGridLoading] = useState(false)
  const [sizeGridTab, setSizeGridTab] = useState<SizeGridTab>('asks')

  // Fetch product info
  const fetchProduct = useCallback(async () => {
    if (!styleId || !enabled) {
      setProduct(null)
      return
    }

    setProductLoading(true)
    try {
      const { data: style } = await supabase
        .from('inventory_v4_style_catalog')
        .select('style_id, name, brand, colorway, primary_image_url, stockx_product_id, alias_catalog_id')
        .eq('style_id', styleId)
        .maybeSingle()

      if (style) {
        setProduct({
          styleId: style.style_id,
          name: style.name,
          brand: style.brand,
          colorway: style.colorway,
          imageUrl: style.primary_image_url,
          releaseDate: null, // TODO: Add to style_catalog
          retailPrice: null, // TODO: Add to style_catalog
        })
        setAliasCatalogId(style.alias_catalog_id)
        setStockxProductId(style.stockx_product_id)
      }
    } finally {
      setProductLoading(false)
    }
  }, [styleId, enabled])

  // Fetch key stats
  const fetchKeyStats = useCallback(async () => {
    if (!aliasCatalogId || !enabled) {
      setKeyStats(null)
      return
    }

    setKeyStatsLoading(true)
    try {
      // Last sale
      const { data: lastSaleData } = await supabase
        .from('inventory_v4_alias_sales_history')
        .select('price, purchased_at')
        .eq('alias_catalog_id', aliasCatalogId)
        .order('purchased_at', { ascending: false })
        .limit(1)

      const lastSale = lastSaleData?.[0]
        ? { price: lastSaleData[0].price, date: lastSaleData[0].purchased_at }
        : null

      // Market price (7-day avg)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentSales } = await supabase
        .from('inventory_v4_alias_sales_history')
        .select('price')
        .eq('alias_catalog_id', aliasCatalogId)
        .gte('purchased_at', sevenDaysAgo)

      const marketPrice = recentSales && recentSales.length > 0
        ? Math.round(recentSales.reduce((sum, s) => sum + s.price, 0) / recentSales.length)
        : null

      // Current market data (StockX + Alias) - get min ask and max bid
      type AskBid = { price: number; provider: 'stockx' | 'alias' } | null
      let lowestAsk: AskBid = null
      let highestBid: AskBid = null

      // Alias market data
      if (aliasCatalogId) {
        const { data: aliasVariants } = await supabase
          .from('inventory_v4_alias_variants')
          .select('id')
          .eq('alias_catalog_id', aliasCatalogId)
          .eq('region_id', aliasRegion)
          .eq('consigned', false)

        if (aliasVariants && aliasVariants.length > 0) {
          const variantIds = aliasVariants.map(v => v.id)
          const { data: aliasMarket } = await supabase
            .from('inventory_v4_alias_market_data')
            .select('lowest_ask, highest_bid')
            .in('alias_variant_id', variantIds)

          if (aliasMarket) {
            const asks = aliasMarket.filter(m => m.lowest_ask != null).map(m => m.lowest_ask as number)
            const bids = aliasMarket.filter(m => m.highest_bid != null).map(m => m.highest_bid as number)

            if (asks.length > 0) {
              const minAsk = Math.min(...asks)
              if (lowestAsk === null || minAsk < (lowestAsk as { price: number }).price) {
                lowestAsk = { price: minAsk, provider: 'alias' }
              }
            }

            if (bids.length > 0) {
              const maxBid = Math.max(...bids)
              if (highestBid === null || maxBid > (highestBid as { price: number }).price) {
                highestBid = { price: maxBid, provider: 'alias' }
              }
            }
          }
        }
      }

      // StockX market data
      if (stockxProductId) {
        const { data: stockxVariants } = await supabase
          .from('inventory_v4_stockx_variants')
          .select('stockx_variant_id')
          .eq('stockx_product_id', stockxProductId)

        if (stockxVariants && stockxVariants.length > 0) {
          const variantIds = stockxVariants.map(v => v.stockx_variant_id)
          const { data: stockxMarket } = await supabase
            .from('inventory_v4_stockx_market_data')
            .select('lowest_ask, highest_bid')
            .in('stockx_variant_id', variantIds)
            .eq('currency_code', 'GBP') // Default to GBP

          if (stockxMarket) {
            const asks = stockxMarket.filter(m => m.lowest_ask != null).map(m => m.lowest_ask as number)
            const bids = stockxMarket.filter(m => m.highest_bid != null).map(m => m.highest_bid as number)

            if (asks.length > 0) {
              const minAsk = Math.min(...asks)
              if (lowestAsk === null || minAsk < (lowestAsk as { price: number }).price) {
                lowestAsk = { price: minAsk, provider: 'stockx' }
              }
            }

            if (bids.length > 0) {
              const maxBid = Math.max(...bids)
              if (highestBid === null || maxBid > (highestBid as { price: number }).price) {
                highestBid = { price: maxBid, provider: 'stockx' }
              }
            }
          }
        }
      }

      setKeyStats({ lastSale, lowestAsk, highestBid, marketPrice })
    } finally {
      setKeyStatsLoading(false)
    }
  }, [aliasCatalogId, stockxProductId, aliasRegion, enabled])

  // Fetch sales data for charts
  const fetchSalesData = useCallback(async () => {
    if (!aliasCatalogId || !enabled) {
      setRawSales(null)
      setDailySales(null)
      setMonthlySales(null)
      return
    }

    setChartLoading(true)
    try {
      // Raw sales (90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      let rawQuery = supabase
        .from('inventory_v4_alias_sales_history')
        .select('purchased_at, price, size_value')
        .eq('alias_catalog_id', aliasCatalogId)
        .gte('purchased_at', ninetyDaysAgo)
        .order('purchased_at', { ascending: true })

      if (sizeFilter) {
        rawQuery = rawQuery.eq('size_value', parseFloat(sizeFilter))
      }

      const { data: raw } = await rawQuery.limit(10000)
      setRawSales(raw as typeof rawSales)

      // Daily aggregates (13 months)
      let dailyQuery = supabase
        .from('inventory_v4_alias_sales_daily')
        .select('sale_date, avg_price, min_price, max_price, sale_count')
        .eq('alias_catalog_id', aliasCatalogId)
        .order('sale_date', { ascending: true })

      if (sizeFilter) {
        dailyQuery = dailyQuery.eq('size_value', parseFloat(sizeFilter))
      }

      const { data: daily } = await dailyQuery.limit(10000)
      setDailySales(daily as typeof dailySales)

      // Monthly aggregates (all time)
      let monthlyQuery = supabase
        .from('inventory_v4_alias_sales_monthly')
        .select('sale_month, avg_price, min_price, max_price, sale_count')
        .eq('alias_catalog_id', aliasCatalogId)
        .order('sale_month', { ascending: true })

      if (sizeFilter) {
        monthlyQuery = monthlyQuery.eq('size_value', parseFloat(sizeFilter))
      }

      const { data: monthly } = await monthlyQuery.limit(1000)
      setMonthlySales(monthly as typeof monthlySales)
    } finally {
      setChartLoading(false)
    }
  }, [aliasCatalogId, sizeFilter, enabled])

  // Fetch size grid data (market data per size)
  const fetchSizeGrid = useCallback(async () => {
    if ((!aliasCatalogId && !stockxProductId) || !enabled) {
      setSizeGrid(null)
      return
    }

    setSizeGridLoading(true)
    try {
      const sizeMap = new Map<string, SizeGridRow>()

      // Get Alias market data
      if (aliasCatalogId) {
        const { data: aliasVariants } = await supabase
          .from('inventory_v4_alias_variants')
          .select('id, size_value')
          .eq('alias_catalog_id', aliasCatalogId)
          .eq('region_id', aliasRegion)
          .eq('consigned', false)

        if (aliasVariants && aliasVariants.length > 0) {
          const variantIds = aliasVariants.map(v => v.id)
          const { data: aliasMarket } = await supabase
            .from('inventory_v4_alias_market_data')
            .select('alias_variant_id, lowest_ask, highest_bid, last_sale_price')
            .in('alias_variant_id', variantIds)

          // Create variant ID to size mapping
          const variantToSize = new Map<string, number>()
          for (const v of aliasVariants) {
            variantToSize.set(v.id, v.size_value)
          }

          if (aliasMarket) {
            for (const market of aliasMarket) {
              const sizeValue = variantToSize.get(market.alias_variant_id)
              if (sizeValue == null) continue

              const sizeKey = sizeValue.toString()
              const existing = sizeMap.get(sizeKey) || {
                size: sizeKey,
                sizeNumeric: sizeValue,
                stockxAsk: null,
                stockxBid: null,
                aliasAsk: null,
                aliasBid: null,
                lastSale: null,
              }

              existing.aliasAsk = market.lowest_ask
              existing.aliasBid = market.highest_bid
              sizeMap.set(sizeKey, existing)
            }
          }
        }
      }

      // Get StockX market data
      if (stockxProductId) {
        const { data: stockxVariants } = await supabase
          .from('inventory_v4_stockx_variants')
          .select('stockx_variant_id, size_us')
          .eq('stockx_product_id', stockxProductId)

        if (stockxVariants && stockxVariants.length > 0) {
          const variantIds = stockxVariants.map(v => v.stockx_variant_id)
          const { data: stockxMarket } = await supabase
            .from('inventory_v4_stockx_market_data')
            .select('stockx_variant_id, lowest_ask, highest_bid')
            .in('stockx_variant_id', variantIds)
            .eq('currency_code', 'USD') // Use USD for consistency with Alias

          // Create variant ID to size mapping (converting US to UK)
          const variantToSize = new Map<string, number>()
          for (const v of stockxVariants) {
            // US to UK: subtract 0.5 for men's (rough approximation)
            const ukSize = v.size_us - 0.5
            variantToSize.set(v.stockx_variant_id, ukSize)
          }

          if (stockxMarket) {
            for (const market of stockxMarket) {
              const sizeValue = variantToSize.get(market.stockx_variant_id)
              if (sizeValue == null) continue

              const sizeKey = sizeValue.toString()
              const existing = sizeMap.get(sizeKey) || {
                size: sizeKey,
                sizeNumeric: sizeValue,
                stockxAsk: null,
                stockxBid: null,
                aliasAsk: null,
                aliasBid: null,
                lastSale: null,
              }

              existing.stockxAsk = market.lowest_ask
              existing.stockxBid = market.highest_bid
              sizeMap.set(sizeKey, existing)
            }
          }
        }
      }

      // Get last sale per size from sales history
      if (aliasCatalogId) {
        const { data: recentSales } = await supabase
          .from('inventory_v4_alias_sales_history')
          .select('size_value, price, purchased_at')
          .eq('alias_catalog_id', aliasCatalogId)
          .order('purchased_at', { ascending: false })
          .limit(1000)

        if (recentSales) {
          // Get most recent sale per size
          const lastSaleBySize = new Map<number, { price: number; date: string }>()
          for (const sale of recentSales) {
            if (!lastSaleBySize.has(sale.size_value)) {
              lastSaleBySize.set(sale.size_value, {
                price: sale.price,
                date: sale.purchased_at,
              })
            }
          }

          for (const [sizeValue, saleData] of lastSaleBySize) {
            const sizeKey = sizeValue.toString()
            const existing = sizeMap.get(sizeKey) || {
              size: sizeKey,
              sizeNumeric: sizeValue,
              stockxAsk: null,
              stockxBid: null,
              aliasAsk: null,
              aliasBid: null,
              lastSale: null,
            }
            existing.lastSale = saleData
            sizeMap.set(sizeKey, existing)
          }
        }
      }

      // Convert to array and sort by size
      const grid = Array.from(sizeMap.values())
        .filter(row =>
          row.stockxAsk != null ||
          row.stockxBid != null ||
          row.aliasAsk != null ||
          row.aliasBid != null ||
          row.lastSale != null
        )
        .sort((a, b) => (a.sizeNumeric || 0) - (b.sizeNumeric || 0))

      setSizeGrid(grid)
    } finally {
      setSizeGridLoading(false)
    }
  }, [aliasCatalogId, stockxProductId, aliasRegion, enabled])

  // Derive chart data based on selected range
  const chartData = useMemo<ChartPoint[] | null>(() => {
    if (chartRange === '7D' || chartRange === '30D' || chartRange === '90D') {
      if (!rawSales || rawSales.length === 0) return null

      // Filter to selected range
      const daysMap: Record<string, number> = { '7D': 7, '30D': 30, '90D': 90 }
      const days = daysMap[chartRange]
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const filtered = rawSales.filter(s => s.purchased_at >= cutoff)
      if (filtered.length === 0) return null

      // Aggregate by day
      const byDay = new Map<string, { prices: number[]; count: number }>()
      for (const sale of filtered) {
        const day = sale.purchased_at.slice(0, 10)
        const existing = byDay.get(day) || { prices: [], count: 0 }
        existing.prices.push(sale.price)
        existing.count++
        byDay.set(day, existing)
      }

      return Array.from(byDay.entries())
        .map(([date, data]) => ({
          date,
          avgPrice: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
          minPrice: Math.min(...data.prices),
          maxPrice: Math.max(...data.prices),
          volume: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    if (chartRange === '13M') {
      if (!dailySales || dailySales.length === 0) return null

      // Aggregate across sizes per day
      const byDay = new Map<string, { count: number; total: number; min: number; max: number }>()
      for (const row of dailySales) {
        const day = row.sale_date.slice(0, 10)
        const existing = byDay.get(day) || { count: 0, total: 0, min: Infinity, max: -Infinity }
        existing.count += row.sale_count
        existing.total += row.avg_price * row.sale_count
        existing.min = Math.min(existing.min, row.min_price)
        existing.max = Math.max(existing.max, row.max_price)
        byDay.set(day, existing)
      }

      return Array.from(byDay.entries())
        .map(([date, data]) => ({
          date,
          avgPrice: Math.round(data.total / data.count),
          minPrice: data.min === Infinity ? 0 : data.min,
          maxPrice: data.max === -Infinity ? 0 : data.max,
          volume: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    if (chartRange === 'ALL') {
      if (!monthlySales || monthlySales.length === 0) return null

      // Aggregate across sizes per month
      const byMonth = new Map<string, { count: number; total: number; min: number; max: number }>()
      for (const row of monthlySales) {
        const month = row.sale_month.slice(0, 7)
        const existing = byMonth.get(month) || { count: 0, total: 0, min: Infinity, max: -Infinity }
        existing.count += row.sale_count
        existing.total += row.avg_price * row.sale_count
        existing.min = Math.min(existing.min, row.min_price)
        existing.max = Math.max(existing.max, row.max_price)
        byMonth.set(month, existing)
      }

      return Array.from(byMonth.entries())
        .map(([date, data]) => ({
          date,
          avgPrice: Math.round(data.total / data.count),
          minPrice: data.min === Infinity ? 0 : data.min,
          maxPrice: data.max === -Infinity ? 0 : data.max,
          volume: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    return null
  }, [chartRange, rawSales, dailySales, monthlySales])

  // Chart summary
  const chartSummary = useMemo(() => {
    if (!chartData || chartData.length === 0) return null

    const prices = chartData.map(p => p.avgPrice)
    const volumes = chartData.map(p => p.volume)

    return {
      high: Math.max(...chartData.map(p => p.maxPrice)),
      low: Math.min(...chartData.map(p => p.minPrice)),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      volume: volumes.reduce((a, b) => a + b, 0),
    }
  }, [chartData])

  // Liquidity metrics
  const liquidity = useMemo<Liquidity | null>(() => {
    if (!rawSales || rawSales.length === 0) return null

    const now = Date.now()
    const h72Ago = now - 72 * 60 * 60 * 1000
    const d30Ago = now - 30 * 24 * 60 * 60 * 1000

    let sales72h = 0
    let sales30d = 0

    for (const sale of rawSales) {
      const saleTime = new Date(sale.purchased_at).getTime()
      if (saleTime >= h72Ago) sales72h++
      if (saleTime >= d30Ago) sales30d++
    }

    return {
      sales72h,
      sales30d,
      avgDaily: Math.round((sales30d / 30) * 10) / 10,
    }
  }, [rawSales])

  // Fetch all data
  const fetchAll = useCallback(async () => {
    await fetchProduct()
  }, [fetchProduct])

  // Chain fetches after product loads
  useEffect(() => {
    if (aliasCatalogId || stockxProductId) {
      fetchKeyStats()
      fetchSalesData()
      fetchSizeGrid()
    }
  }, [aliasCatalogId, stockxProductId, fetchKeyStats, fetchSalesData, fetchSizeGrid])

  // Initial fetch
  useEffect(() => {
    if (enabled && styleId) {
      fetchAll()
    }
  }, [enabled, styleId, fetchAll])

  return {
    product,
    productLoading,
    keyStats,
    keyStatsLoading,
    chartData,
    chartRange,
    setChartRange,
    chartLoading,
    chartSummary,
    liquidity,
    liquidityLoading: chartLoading,
    sizeGrid,
    sizeGridLoading,
    sizeGridTab,
    setSizeGridTab,
    refetch: fetchAll,
  }
}
