'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { formatRelativeTime } from '@/lib/utils/formatRelativeTime'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import type { Mover } from '@/hooks/useDashboardMovers'

interface DashboardMoversProps {
  movers: Mover[]
  loading?: boolean
  sortBy?: 'performance' | 'market_value'
  onSortChange?: (sortBy: 'performance' | 'market_value') => void
}

// Helper to generate synthetic sparkline data
// Note: Real sparkline endpoint exists at /api/portfolio/movers/sparkline but uses
// synthetic data to avoid N+1 queries. Future: implement batch sparkline endpoint.
function generateSparklineData(baseValue: number, performance: number) {
  const points = 15
  const data = []
  const trend = performance / 100 // Convert percentage to decimal

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    // Create smooth trend with some randomness
    const trendValue = baseValue * (1 + trend * progress)
    const noise = (Math.random() - 0.5) * baseValue * 0.05 // ±5% noise
    data.push({
      value: Math.max(0, trendValue + noise),
    })
  }

  return data
}

export function DashboardMovers({
  movers,
  loading = false,
  sortBy = 'performance',
  onSortChange,
}: DashboardMoversProps) {
  const { format } = useCurrency()
  const [expanded, setExpanded] = useState(false)

  // Show top 10 by default, all when expanded
  const displayMovers = expanded ? movers : movers.slice(0, 10)

  if (loading) {
    return (
      <Card className="p-5 bg-elev-2 border-border/40">
        <div className="h-5 bg-elev-1 rounded w-32 mb-4 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-12 w-12 bg-elev-1 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-elev-1 rounded w-3/4 mb-2" />
                <div className="h-3 bg-elev-1 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (movers.length === 0) {
    return (
      <Card className="p-5 bg-elev-2 border-border/40">
        <h3 className="text-sm font-medium text-neutral-50 mb-4">Your Movers</h3>
        <div className="text-center py-8">
          <p className="text-sm text-neutral-300">No items with market data yet.</p>
          <p className="text-[11px] text-neutral-400 mt-2">Add items to track your top performers</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-5 bg-elev-2 border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-50">Your Movers</h3>
        {onSortChange && (
          <div className="flex gap-1">
            <button
              onClick={() => onSortChange('performance')}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-medium transition-colors',
                sortBy === 'performance'
                  ? 'bg-accent/20 text-accent border border-accent/60'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              % Gain
            </button>
            <button
              onClick={() => onSortChange('market_value')}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-medium transition-colors',
                sortBy === 'market_value'
                  ? 'bg-accent/20 text-accent border border-accent/60'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              Value
            </button>
          </div>
        )}
      </div>

      {/* Movers List */}
      <div className="space-y-2">
        {displayMovers.map((mover, index) => {
          const isPositive = mover.performance_pct >= 0

          return (
            <div
              key={mover.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-elev-1 border border-border/20 hover:border-border/40 transition-colors cursor-pointer group"
            >
              {/* Rank Badge */}
              <div className="flex-shrink-0 w-6 text-center">
                <span className="text-xs font-bold text-dim mono">{index + 1}</span>
              </div>

              {/* Image/Placeholder */}
              <div className="flex-shrink-0">
                {mover.image_url ? (
                  <img
                    src={mover.image_url}
                    alt={`${mover.brand} ${mover.model}`}
                    className="h-12 w-12 rounded object-cover border border-border/40"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-elev-2 border border-border/40 flex items-center justify-center">
                    <span className="text-xs font-bold text-muted mono">
                      {mover.brand?.substring(0, 2).toUpperCase() || '??'}
                    </span>
                  </div>
                )}
              </div>

              {/* Details + Mini Chart */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate group-hover:text-accent transition-colors">
                    {mover.brand} {mover.model}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-dim mono">{mover.size}</span>
                    {mover.colorway && (
                      <>
                        <span className="text-xs text-dim">•</span>
                        <span className="text-xs text-dim truncate max-w-[100px]">{mover.colorway}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Mini Sparkline */}
                <div className="hidden sm:block w-20 h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={generateSparklineData(mover.market_value, mover.performance_pct)}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)'}
                        fill={isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)'}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance */}
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold mono tabular-nums text-fg mb-0.5">
                  {format(mover.market_value)}
                </p>
                <div
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-semibold rounded px-1.5 py-0.5',
                    isPositive ? 'money-pos-tint' : 'money-neg-tint'
                  )}
                >
                  <TrendingUp className={cn('h-2.5 w-2.5', isPositive ? '' : 'rotate-180')} />
                  {isPositive ? '+' : ''}
                  {mover.performance_pct.toFixed(1)}%
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Expand/Collapse Button */}
      {movers.length > 10 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 h-8 text-xs text-muted hover:text-fg"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : `Show ${movers.length - 10} More`}
          <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', expanded && 'rotate-180')} />
        </Button>
      )}

      {/* Footer Note */}
      {movers.length > 0 && movers[0].price_as_of && (
        <p className="text-[11px] text-neutral-400 text-center mt-4">
          Prices updated {formatRelativeTime(movers[0].price_as_of)}
        </p>
      )}
    </Card>
  )
}
