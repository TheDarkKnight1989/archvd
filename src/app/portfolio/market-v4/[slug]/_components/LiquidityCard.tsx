'use client'

/**
 * LiquidityCard - Market liquidity metrics
 *
 * Shows: 72h sales, 30d sales, avg daily
 * Indicator: High/Medium/Low
 */

import type { Liquidity } from '@/hooks/useMarketPageData'

interface LiquidityCardProps {
  data: Liquidity | null
  loading?: boolean
}

export function LiquidityCard({ data, loading }: LiquidityCardProps) {
  if (loading) {
    return (
      <div className="border rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-20 mb-3" />
        <div className="space-y-3">
          <div className="h-5 bg-muted rounded w-24" />
          <div className="h-5 bg-muted rounded w-28" />
          <div className="h-5 bg-muted rounded w-20" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="border rounded-lg p-4">
        <div className="text-sm font-medium mb-3">Liquidity</div>
        <div className="text-sm text-muted-foreground">No data</div>
      </div>
    )
  }

  const level = getLiquidityLevel(data.avgDaily)

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Liquidity</div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            level === 'high'
              ? 'bg-green-500/10 text-green-600'
              : level === 'medium'
              ? 'bg-amber-500/10 text-amber-600'
              : 'bg-red-500/10 text-red-600'
          }`}
        >
          {level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">72h</span>
          <span className="text-sm font-mono">{data.sales72h} sales</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">30d</span>
          <span className="text-sm font-mono">{data.sales30d} sales</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Avg/day</span>
          <span className="text-sm font-mono">{data.avgDaily}</span>
        </div>
      </div>
    </div>
  )
}

function getLiquidityLevel(avgDaily: number): 'high' | 'medium' | 'low' {
  if (avgDaily >= 10) return 'high'
  if (avgDaily >= 3) return 'medium'
  return 'low'
}
