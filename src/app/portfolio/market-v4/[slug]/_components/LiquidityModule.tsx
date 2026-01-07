'use client'

/**
 * LiquidityModule - V4 Market Liquidity Metrics
 *
 * Shows:
 * - Sales in last 72 hours
 * - Sales in last 30 days
 * - Average daily sales
 * - Most active sizes
 */

import type { LiquidityMetrics } from '@/hooks/useV4SalesHistory'

interface LiquidityModuleProps {
  data: LiquidityMetrics | null
  loading?: boolean
  error?: Error | null
}

export function LiquidityModule({ data, loading, error }: LiquidityModuleProps) {
  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">Liquidity</h3>
        <div className="h-32 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">Liquidity</h3>
        <div className="text-red-500 text-sm">Error: {error.message}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">Liquidity</h3>
        <div className="text-muted-foreground text-sm">No data available</div>
      </div>
    )
  }

  // Determine liquidity level
  const liquidityLevel = getLiquidityLevel(data.avgDailySales30d)

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Liquidity</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            liquidityLevel === 'high'
              ? 'bg-green-500/10 text-green-600'
              : liquidityLevel === 'medium'
              ? 'bg-amber-500/10 text-amber-600'
              : 'bg-red-500/10 text-red-600'
          }`}
        >
          {liquidityLevel === 'high'
            ? 'High'
            : liquidityLevel === 'medium'
            ? 'Medium'
            : 'Low'}
        </span>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold">{data.salesLast72h}</div>
          <div className="text-xs text-muted-foreground">Last 72h</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.salesLast30d}</div>
          <div className="text-xs text-muted-foreground">Last 30d</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{data.avgDailySales30d}</div>
          <div className="text-xs text-muted-foreground">Avg/day</div>
        </div>
      </div>

      {/* Most active sizes */}
      {data.mostActiveSizes.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            Most Active Sizes (30d)
          </div>
          <div className="flex flex-wrap gap-2">
            {data.mostActiveSizes.map((s) => (
              <div
                key={s.size}
                className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-xs"
              >
                <span className="font-medium">{s.size}</span>
                <span className="text-muted-foreground">({s.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getLiquidityLevel(avgDaily: number): 'high' | 'medium' | 'low' {
  if (avgDaily >= 10) return 'high'
  if (avgDaily >= 3) return 'medium'
  return 'low'
}
