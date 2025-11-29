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
      <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-28 animate-pulse" />
              <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-36 animate-pulse" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-8 w-16 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded-full animate-pulse" />
              <div className="h-8 w-16 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded-full animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-elev-1 to-elev-2/50 border border-border/30">
                <div className="h-7 w-7 bg-gradient-to-br from-elev-1 to-elev-1/50 rounded-full animate-pulse" />
                <div className="h-14 w-14 bg-gradient-to-br from-elev-1 to-elev-1/50 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-1/2 animate-pulse" />
                </div>
                <div className="text-right space-y-2">
                  <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-20 animate-pulse ml-auto" />
                  <div className="h-6 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded-full w-16 animate-pulse ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (movers.length === 0) {
    return (
      <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-50 pointer-events-none" />

        <div className="relative">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-neutral-50 mb-0.5">Your Movers</h3>
            <p className="text-[10px] text-neutral-400">Top performing items</p>
          </div>

          <div className="text-center py-12">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-accent/70" />
            </div>

            {/* Text */}
            <p className="text-sm font-semibold text-neutral-200 mb-1">No movers yet</p>
            <p className="text-xs text-neutral-400 max-w-[200px] mx-auto">
              Add items with market data to see your top performers here
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 hover:border-accent/30 transition-all duration-300 overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-50 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-50 mb-0.5">Your Movers</h3>
          <p className="text-[10px] text-neutral-400">Top performing items</p>
        </div>
        {onSortChange && (
          <div className="flex gap-1.5">
            <button
              onClick={() => onSortChange('performance')}
              className={cn(
                'px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 uppercase tracking-wider',
                sortBy === 'performance'
                  ? 'bg-gradient-to-r from-accent/30 to-accent/20 text-accent border border-accent/60 shadow-[0_0_12px_rgba(196,164,132,0.3)]'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-accent/5 border border-transparent'
              )}
            >
              % Gain
            </button>
            <button
              onClick={() => onSortChange('market_value')}
              className={cn(
                'px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-300 uppercase tracking-wider',
                sortBy === 'market_value'
                  ? 'bg-gradient-to-r from-accent/30 to-accent/20 text-accent border border-accent/60 shadow-[0_0_12px_rgba(196,164,132,0.3)]'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-accent/5 border border-transparent'
              )}
            >
              Value
            </button>
          </div>
        )}
      </div>

      {/* Movers List */}
      <div className="relative space-y-2">
        {displayMovers.map((mover, index) => {
          const isPositive = mover.performance_pct >= 0

          return (
            <div
              key={mover.id}
              className="relative flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-elev-1 to-elev-2/50 border border-border/30 hover:border-accent/40 transition-all duration-300 cursor-pointer group hover:shadow-[0_0_20px_rgba(196,164,132,0.08)] hover:scale-[1.01]"
            >
              {/* Rank Badge with gradient */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center">
                <span className="text-[10px] font-bold text-accent mono">{index + 1}</span>
              </div>

              {/* Image/Placeholder with better styling */}
              <div className="flex-shrink-0">
                {mover.image_url ? (
                  <img
                    src={mover.image_url}
                    alt={`${mover.brand} ${mover.model}`}
                    className="h-14 w-14 rounded-lg object-cover border border-border/40 group-hover:border-accent/40 transition-colors shadow-sm"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-elev-2 to-elev-1 border border-border/40 group-hover:border-accent/40 transition-colors flex items-center justify-center">
                    <span className="text-xs font-bold text-accent/70 mono">
                      {mover.brand?.substring(0, 2).toUpperCase() || '??'}
                    </span>
                  </div>
                )}
              </div>

              {/* Details + Mini Chart */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fg truncate group-hover:text-accent transition-colors">
                    {mover.brand} {mover.model}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-400 mono font-medium">{mover.size}</span>
                    {mover.colorway && (
                      <>
                        <span className="text-xs text-neutral-600">•</span>
                        <span className="text-xs text-neutral-400 truncate max-w-[100px]">{mover.colorway}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Mini Sparkline with enhanced styling */}
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
                        fill={isPositive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance with premium pill badge */}
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold mono tabular-nums text-fg mb-1">
                  {format(mover.market_value)}
                </p>
                <div
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border shadow-sm',
                    isPositive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                      : 'bg-gradient-to-r from-red-500/20 to-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.2)]'
                  )}
                >
                  <TrendingUp className={cn('h-3 w-3', isPositive ? '' : 'rotate-180')} />
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
          className="relative w-full mt-3 h-9 text-xs font-semibold text-neutral-400 hover:text-accent hover:bg-accent/5 border border-transparent hover:border-accent/30 transition-all duration-300"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : `Show ${movers.length - 10} More`}
          <ChevronDown className={cn('h-3.5 w-3.5 ml-2 transition-transform duration-300', expanded && 'rotate-180')} />
        </Button>
      )}

      {/* Footer Note */}
      {movers.length > 0 && movers[0].price_as_of && (
        <p className="relative text-[10px] text-neutral-400 text-center mt-4 font-medium">
          Prices updated {formatRelativeTime(movers[0].price_as_of)}
        </p>
      )}
    </Card>
  )
}
