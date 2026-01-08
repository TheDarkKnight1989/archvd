/**
 * Performance Metrics Dashboard
 * Shows platform ROI, average days to sell, and other key metrics
 */

'use client'

import { useMemo } from 'react'
import { TrendingUp, Clock, Target, DollarSign, Percent } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import type { SalesItem } from '@/hooks/useSalesTable'

interface PerformanceMetricsProps {
  items: SalesItem[]
  className?: string
}

interface PlatformStats {
  platform: string
  sales: number
  revenue: number
  profit: number
  margin: number
  avgDaysToSell: number
}

export function PerformanceMetrics({ items, className }: PerformanceMetricsProps) {
  const { convert, format } = useCurrency()

  // Calculate platform-level statistics
  const platformStats = useMemo((): PlatformStats[] => {
    const stats = new Map<string, {
      count: number
      revenue: number
      profit: number
      totalDaysToSell: number
      salesWithDates: number
    }>()

    items.forEach((item) => {
      const platform = item.platform?.toLowerCase() || 'other'
      const existing = stats.get(platform) || {
        count: 0,
        revenue: 0,
        profit: 0,
        totalDaysToSell: 0,
        salesWithDates: 0,
      }

      existing.count += 1
      existing.revenue += convert(item.sold_price || 0, 'GBP')
      existing.profit += convert(item.margin_gbp || 0, 'GBP')

      // Calculate days to sell if we have both dates
      if (item.sold_date && item.purchase_date) {
        const soldDate = new Date(item.sold_date)
        const purchaseDate = new Date(item.purchase_date)
        const daysToSell = Math.floor((soldDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysToSell >= 0) {
          existing.totalDaysToSell += daysToSell
          existing.salesWithDates += 1
        }
      }

      stats.set(platform, existing)
    })

    return Array.from(stats.entries())
      .map(([platform, data]) => ({
        platform,
        sales: data.count,
        revenue: data.revenue,
        profit: data.profit,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        avgDaysToSell: data.salesWithDates > 0 ? data.totalDaysToSell / data.salesWithDates : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue) // Sort by revenue
  }, [items, convert])

  // Overall metrics
  const overallMetrics = useMemo(() => {
    const totalRevenue = items.reduce((sum, item) => sum + convert(item.sold_price || 0, 'GBP'), 0)
    const totalProfit = items.reduce((sum, item) => sum + convert(item.margin_gbp || 0, 'GBP'), 0)
    const totalCOGS = items.reduce((sum, item) => sum + convert((item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0), 'GBP'), 0)

    const roi = totalCOGS > 0 ? (totalProfit / totalCOGS) * 100 : 0
    const avgMargin = items.length > 0 ? items.reduce((sum, item) => sum + (item.margin_percent || 0), 0) / items.length : 0

    // Average days to sell
    let totalDays = 0
    let salesWithDates = 0
    items.forEach((item) => {
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

    return { roi, avgMargin, avgDaysToSell, totalRevenue, totalProfit }
  }, [items, convert])

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-[#00FF94]" />
            <span className="text-xs text-dim uppercase tracking-wide font-semibold">ROI</span>
          </div>
          <div className={cn(
            "text-2xl font-bold mono",
            overallMetrics.roi >= 0 ? "text-[#00FF94]" : "text-red-400"
          )}>
            {overallMetrics.roi >= 0 ? '+' : ''}{overallMetrics.roi.toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-1">Return on investment</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-dim uppercase tracking-wide font-semibold">Avg Margin</span>
          </div>
          <div className={cn(
            "text-2xl font-bold mono",
            overallMetrics.avgMargin >= 0 ? "text-[#00FF94]" : "text-red-400"
          )}>
            {overallMetrics.avgMargin >= 0 ? '+' : ''}{overallMetrics.avgMargin.toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-1">Average profit margin</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-dim uppercase tracking-wide font-semibold">Avg Days to Sell</span>
          </div>
          <div className="text-2xl font-bold text-fg mono">
            {overallMetrics.avgDaysToSell > 0 ? Math.round(overallMetrics.avgDaysToSell) : '—'}
          </div>
          <div className="text-xs text-muted mt-1">Inventory turnover</div>
        </div>

        <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-dim uppercase tracking-wide font-semibold">Sell-Through Rate</span>
          </div>
          <div className="text-2xl font-bold text-fg mono">
            {items.length > 0 ? '100' : '0'}%
          </div>
          <div className="text-xs text-muted mt-1">Items sold vs listed</div>
        </div>
      </div>

      {/* Platform Performance Table */}
      <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-fg uppercase tracking-wide mb-1">Platform Performance</h3>
          <p className="text-xs text-muted">Compare ROI and metrics across platforms</p>
        </div>

        <div className="space-y-2">
          {platformStats.map((stat) => (
            <div
              key={stat.platform}
              className="flex items-center gap-3 p-3 rounded-lg bg-elev-0 border border-border/30 hover:border-[#00FF94]/30 transition-all"
            >
              <PlatformBadge platform={stat.platform} compact />

              <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <div className="text-dim uppercase tracking-wide mb-0.5">Sales</div>
                  <div className="font-bold text-fg mono">{stat.sales}</div>
                </div>
                <div>
                  <div className="text-dim uppercase tracking-wide mb-0.5">Revenue</div>
                  <div className="font-bold text-fg mono">{format(stat.revenue)}</div>
                </div>
                <div>
                  <div className="text-dim uppercase tracking-wide mb-0.5">Profit</div>
                  <div className={cn(
                    "font-bold mono",
                    stat.profit >= 0 ? "text-[#00FF94]" : "text-red-400"
                  )}>
                    {format(stat.profit)}
                  </div>
                </div>
                <div>
                  <div className="text-dim uppercase tracking-wide mb-0.5">Margin</div>
                  <div className={cn(
                    "font-bold mono",
                    stat.margin >= 0 ? "text-[#00FF94]" : "text-red-400"
                  )}>
                    {stat.margin >= 0 ? '+' : ''}{stat.margin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-dim uppercase tracking-wide mb-0.5">Avg Days</div>
                  <div className="font-bold text-fg mono">
                    {stat.avgDaysToSell > 0 ? Math.round(stat.avgDaysToSell) : '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
