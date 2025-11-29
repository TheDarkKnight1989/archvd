/**
 * Performance Insights Component
 * Shows top/worst performing brands, platforms, categories
 */

'use client'

import { TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DrillDownData } from './DrillDownModal'

interface PerformanceItem {
  name: string
  revenue: number
  profit: number
  margin: number
  count: number
  items: any[]
}

interface PerformanceInsightsProps {
  items: any[]
  formatCurrency: (value: number) => string
  onDrillDown?: (data: DrillDownData) => void
}

export function PerformanceInsights({ items, formatCurrency, onDrillDown }: PerformanceInsightsProps) {
  // Group by brand
  const brandStats = groupByKey(items, 'brand')
  // Group by platform
  const platformStats = groupByKey(items, 'platform')

  const topBrands = sortByProfit(brandStats).slice(0, 5)
  const topPlatforms = sortByProfit(platformStats).slice(0, 3)
  const worstBrands = sortByProfit(brandStats).reverse().slice(0, 3)

  const handleDrillDown = (type: 'brand' | 'platform', name: string, stats: PerformanceItem) => {
    if (onDrillDown) {
      onDrillDown({
        type,
        title: name,
        items: stats.items,
        summary: {
          revenue: stats.revenue,
          profit: stats.profit,
          margin: stats.margin,
          count: stats.count
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Brands */}
        <div className="bg-elev-1 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-[#00FF94]" />
            <h3 className="text-lg font-semibold text-fg">Top 5 Brands by Profit</h3>
          </div>
          <div className="space-y-3">
            {topBrands.map((brand, index) => (
              <PerformanceRow
                key={brand.name || 'unknown'}
                rank={index + 1}
                item={brand}
                formatCurrency={formatCurrency}
                isTop
                onClick={() => handleDrillDown('brand', brand.name || 'Unknown', brand)}
              />
            ))}
          </div>
        </div>

        {/* Top Platforms */}
        <div className="bg-elev-1 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-fg">Platform Performance</h3>
          </div>
          <div className="space-y-3">
            {topPlatforms.map((platform, index) => (
              <PerformanceRow
                key={platform.name || 'unknown'}
                rank={index + 1}
                item={platform}
                formatCurrency={formatCurrency}
                isTop
                onClick={() => handleDrillDown('platform', platform.name || 'Unknown', platform)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Worst Performers */}
      <div className="bg-elev-1 border border-red-500/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-red-400" />
          <h3 className="text-lg font-semibold text-fg">Bottom 3 Brands (Avoid)</h3>
          <span className="text-xs text-dim ml-2">Lowest profit margins</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {worstBrands.map((brand) => (
            <div
              key={brand.name || 'unknown'}
              className="p-3 bg-elev-0 border border-red-500/20 rounded-lg"
            >
              <div className="text-sm font-semibold text-fg mb-1 truncate">{brand.name || 'Unknown'}</div>
              <div className="text-xs text-dim mb-2">{brand.count} sales</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted">Margin</div>
                  <div className={cn(
                    'text-sm font-bold mono',
                    brand.margin >= 0 ? 'text-red-400' : 'text-red-500'
                  )}>
                    {brand.margin.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Profit</div>
                  <div className="text-sm font-bold mono text-red-400">
                    {formatCurrency(brand.profit)}
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

function PerformanceRow({
  rank,
  item,
  formatCurrency,
  isTop,
  onClick
}: {
  rank: number
  item: PerformanceItem
  formatCurrency: (value: number) => string
  isTop: boolean
  onClick?: () => void
}) {
  const medalColors = ['text-[#FFD700]', 'text-[#C0C0C0]', 'text-[#CD7F32]']
  const medalColor = rank <= 3 ? medalColors[rank - 1] : 'text-dim'

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 bg-elev-0 rounded-lg border border-border/30",
        onClick && "cursor-pointer hover:border-accent/40 hover:bg-elev-1 transition-all"
      )}
    >
      <div className={cn('text-lg font-bold mono w-6 text-center', medalColor)}>
        {rank}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-fg truncate">{item.name || 'Unknown'}</div>
        <div className="text-xs text-dim">{item.count} sales • {formatCurrency(item.revenue)} revenue</div>
      </div>
      <div className="text-right">
        <div className={cn(
          'text-sm font-bold mono',
          item.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
        )}>
          {formatCurrency(item.profit)}
        </div>
        <div className="text-xs text-dim">{item.margin.toFixed(1)}% margin</div>
      </div>
    </div>
  )
}

function groupByKey(items: any[], key: string): PerformanceItem[] {
  const grouped = new Map<string, { revenue: number; profit: number; count: number; items: any[] }>()

  items.forEach((item) => {
    const name = item[key] || 'Unknown'
    const existing = grouped.get(name) || { revenue: 0, profit: 0, count: 0, items: [] }

    existing.revenue += item.salePrice || 0
    existing.profit += item.margin || 0
    existing.count += 1
    existing.items.push(item)

    grouped.set(name, existing)
  })

  return Array.from(grouped.entries()).map(([name, stats]) => ({
    name,
    revenue: stats.revenue,
    profit: stats.profit,
    margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
    count: stats.count,
    items: stats.items
  }))
}

function sortByProfit(items: PerformanceItem[]): PerformanceItem[] {
  return [...items].sort((a, b) => b.profit - a.profit)
}
