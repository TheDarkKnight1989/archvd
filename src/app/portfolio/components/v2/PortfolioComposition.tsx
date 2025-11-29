'use client'

import { Package, Store, PieChart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import type { Mover } from '@/hooks/useDashboardMovers'

interface PortfolioCompositionProps {
  movers: Mover[]
  loading?: boolean
}

interface CompositionItem {
  label: string
  value: number
  percentage: number
  color: string
}

export function PortfolioComposition({ movers, loading = false }: PortfolioCompositionProps) {
  const { format } = useCurrency()

  if (loading) {
    return (
      <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        <div className="relative space-y-4">
          <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-32 animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (movers.length === 0) {
    return null
  }

  // Calculate brand composition
  const brandMap = new Map<string, number>()
  movers.forEach((mover) => {
    const brand = mover.brand || 'Unknown'
    const current = brandMap.get(brand) || 0
    brandMap.set(brand, current + mover.market_value)
  })

  const totalValue = Array.from(brandMap.values()).reduce((sum, val) => sum + val, 0)
  const brandComposition: CompositionItem[] = Array.from(brandMap.entries())
    .map(([label, value]) => ({
      label,
      value,
      percentage: (value / totalValue) * 100,
      color: '', // Will be assigned below
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  // Assign colors
  const brandColors = [
    'from-accent/30 to-accent/10',
    'from-blue-500/30 to-blue-500/10',
    'from-purple-500/30 to-purple-500/10',
    'from-emerald-500/30 to-emerald-500/10',
    'from-orange-500/30 to-orange-500/10',
  ]
  brandComposition.forEach((item, index) => {
    item.color = brandColors[index] || brandColors[0]
  })

  // Calculate "Others" if needed
  const topBrandsValue = brandComposition.reduce((sum, item) => sum + item.value, 0)
  const othersValue = totalValue - topBrandsValue
  if (othersValue > 0) {
    brandComposition.push({
      label: 'Others',
      value: othersValue,
      percentage: (othersValue / totalValue) * 100,
      color: 'from-neutral-500/30 to-neutral-500/10',
    })
  }

  return (
    <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 hover:border-accent/30 transition-all duration-300 overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-50 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center">
          <PieChart className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Portfolio Composition</h3>
          <p className="text-[10px] text-neutral-400">By brand value</p>
        </div>
      </div>

      {/* Brand Breakdown */}
      <div className="relative space-y-2">
        {brandComposition.map((item, index) => (
          <div key={item.label} className="group relative">
            {/* Bar container */}
            <div className="flex items-center gap-3">
              {/* Rank badge */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center">
                <span className="text-[9px] font-bold text-accent mono">{index + 1}</span>
              </div>

              {/* Label and bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-200 truncate">{item.label}</span>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs font-bold text-neutral-300 mono tabular-nums">{format(item.value)}</span>
                    <span className="text-[10px] font-semibold text-neutral-400 mono tabular-nums min-w-[40px] text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden shadow-inner">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', `bg-gradient-to-r ${item.color}`, 'shadow-sm')}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="relative mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-[10px] text-neutral-400 font-medium">{brandMap.size} brands</span>
        </div>
        <div className="flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-[10px] text-neutral-400 font-medium">{movers.length} items</span>
        </div>
        <div className="text-[10px] font-semibold text-accent mono">
          Total: {format(totalValue)}
        </div>
      </div>
    </Card>
  )
}
