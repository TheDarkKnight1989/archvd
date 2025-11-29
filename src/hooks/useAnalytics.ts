'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface InventoryItem {
  id: string
  sku: string
  brand?: string | null
  model?: string | null
  colorway?: string | null
  size_uk?: string | null
  category?: string | null
  purchase_price: number
  purchase_date?: string | null
  sold_date?: string | null
  sold_price?: number | null
  status: 'available' | 'sold' | 'listed'
  platform?: string | null
  image_url?: string | null
  created_at: string
  tax?: number | null
  shipping?: number | null
  sales_fee?: number | null
}

export interface AgingBucket {
  range: string
  count: number
  totalValue: number
  items: InventoryItem[]
  color: string
  description: string
}

export interface TopPerformer {
  id: string
  sku: string
  brand?: string | null
  model?: string | null
  image_url?: string | null
  profit: number
  margin: number
  daysToSell: number
  sold_price: number
}

export interface AnalyticsData {
  // Overview metrics
  totalRevenue: number
  totalCOGS: number
  grossProfit: number
  grossMargin: number
  avgMargin: number

  // Inventory metrics
  activeInventoryCount: number
  activeInventoryValue: number
  avgDaysToSell: number
  inventoryTurnover: number

  // Aging buckets
  agingBuckets: AgingBucket[]

  // Dead stock
  deadStockItems: InventoryItem[]
  deadStockValue: number

  // Top performers
  topPerformers: TopPerformer[]
  worstPerformers: TopPerformer[]

  // Platform breakdown
  platformBreakdown: {
    platform: string
    sales: number
    revenue: number
    profit: number
    margin: number
  }[]
}

export function useAnalytics(userId?: string, refreshKey?: number) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchAnalytics() {
      try {
        setLoading(true)

        // Fetch all inventory items (both available and sold)
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('Inventory')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (inventoryError) throw inventoryError

        const items = inventoryData as InventoryItem[]

        // Calculate analytics
        const analytics = calculateAnalytics(items)
        setData(analytics)
        setError(null)
      } catch (err) {
        console.error('[useAnalytics] Error:', err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [userId, refreshKey])

  return { data, loading, error }
}

function calculateAnalytics(items: InventoryItem[]): AnalyticsData {
  const now = new Date()

  // Separate sold and available items
  const soldItems = items.filter(item => item.status === 'sold')
  const availableItems = items.filter(item => item.status === 'available')

  // Calculate overview metrics
  const totalRevenue = soldItems.reduce((sum, item) => sum + (item.sold_price || 0), 0)
  const totalCOGS = soldItems.reduce((sum, item) => {
    const cost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
    return sum + cost
  }, 0)
  const totalFees = soldItems.reduce((sum, item) => sum + (item.sales_fee || 0), 0)
  const grossProfit = totalRevenue - totalCOGS - totalFees
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // Calculate average margin
  const marginsSum = soldItems.reduce((sum, item) => {
    const cost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
    const fees = item.sales_fee || 0
    const revenue = item.sold_price || 0
    const profit = revenue - cost - fees
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0
    return sum + margin
  }, 0)
  const avgMargin = soldItems.length > 0 ? marginsSum / soldItems.length : 0

  // Calculate inventory metrics
  const activeInventoryCount = availableItems.length
  const activeInventoryValue = availableItems.reduce((sum, item) => {
    return sum + item.purchase_price + (item.tax || 0) + (item.shipping || 0)
  }, 0)

  // Calculate average days to sell
  let totalDays = 0
  let salesWithDates = 0
  soldItems.forEach(item => {
    if (item.sold_date && item.purchase_date) {
      const soldDate = new Date(item.sold_date)
      const purchaseDate = new Date(item.purchase_date)
      const days = Math.floor((soldDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      if (days >= 0) {
        totalDays += days
        salesWithDates += 1
      }
    }
  })
  const avgDaysToSell = salesWithDates > 0 ? totalDays / salesWithDates : 0

  // Calculate inventory turnover (sales / avg inventory)
  const inventoryTurnover = activeInventoryCount > 0 ? soldItems.length / activeInventoryCount : 0

  // Calculate aging buckets for available inventory
  const agingBuckets: AgingBucket[] = [
    {
      range: '0-30 days',
      count: 0,
      totalValue: 0,
      items: [],
      color: 'text-[#00FF94]',
      description: 'Fresh inventory'
    },
    {
      range: '31-90 days',
      count: 0,
      totalValue: 0,
      items: [],
      color: 'text-blue-400',
      description: 'Aging inventory'
    },
    {
      range: '91-180 days',
      count: 0,
      totalValue: 0,
      items: [],
      color: 'text-amber-400',
      description: 'Stale inventory'
    },
    {
      range: '180+ days',
      count: 0,
      totalValue: 0,
      items: [],
      color: 'text-red-400',
      description: 'Dead stock'
    }
  ]

  availableItems.forEach(item => {
    const purchaseDate = item.purchase_date ? new Date(item.purchase_date) : new Date(item.created_at)
    const daysOld = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    const itemValue = item.purchase_price + (item.tax || 0) + (item.shipping || 0)

    if (daysOld <= 30) {
      agingBuckets[0].count++
      agingBuckets[0].totalValue += itemValue
      agingBuckets[0].items.push(item)
    } else if (daysOld <= 90) {
      agingBuckets[1].count++
      agingBuckets[1].totalValue += itemValue
      agingBuckets[1].items.push(item)
    } else if (daysOld <= 180) {
      agingBuckets[2].count++
      agingBuckets[2].totalValue += itemValue
      agingBuckets[2].items.push(item)
    } else {
      agingBuckets[3].count++
      agingBuckets[3].totalValue += itemValue
      agingBuckets[3].items.push(item)
    }
  })

  // Dead stock is 180+ days old
  const deadStockItems = agingBuckets[3].items
  const deadStockValue = agingBuckets[3].totalValue

  // Calculate top and worst performers
  const performers = soldItems
    .filter(item => item.sold_date && item.purchase_date && item.sold_price)
    .map(item => {
      const cost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
      const fees = item.sales_fee || 0
      const revenue = item.sold_price || 0
      const profit = revenue - cost - fees
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0

      const soldDate = new Date(item.sold_date!)
      const purchaseDate = new Date(item.purchase_date!)
      const daysToSell = Math.floor((soldDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: item.id,
        sku: item.sku,
        brand: item.brand,
        model: item.model,
        image_url: item.image_url,
        profit,
        margin,
        daysToSell,
        sold_price: revenue
      }
    })

  const topPerformers = performers
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)

  const worstPerformers = performers
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 10)

  // Calculate platform breakdown
  const platformMap = new Map<string, { sales: number; revenue: number; profit: number }>()

  soldItems.forEach(item => {
    const platform = item.platform?.toLowerCase() || 'other'
    const cost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)
    const fees = item.sales_fee || 0
    const revenue = item.sold_price || 0
    const profit = revenue - cost - fees

    const existing = platformMap.get(platform) || { sales: 0, revenue: 0, profit: 0 }
    existing.sales += 1
    existing.revenue += revenue
    existing.profit += profit
    platformMap.set(platform, existing)
  })

  const platformBreakdown = Array.from(platformMap.entries())
    .map(([platform, data]) => ({
      platform,
      sales: data.sales,
      revenue: data.revenue,
      profit: data.profit,
      margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    totalRevenue,
    totalCOGS,
    grossProfit,
    grossMargin,
    avgMargin,
    activeInventoryCount,
    activeInventoryValue,
    avgDaysToSell,
    inventoryTurnover,
    agingBuckets,
    deadStockItems,
    deadStockValue,
    topPerformers,
    worstPerformers,
    platformBreakdown
  }
}
