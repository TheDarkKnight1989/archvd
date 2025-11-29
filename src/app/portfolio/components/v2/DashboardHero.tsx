'use client'

import { TrendingUp, TrendingDown, Package, Wallet, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { formatRelativeTime } from '@/lib/utils/formatRelativeTime'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

// Helper to generate synthetic 7-day sparkline data
function generateSparklineData(currentValue: number, changePercent: number | null) {
  const points = 7
  const data = []

  // If no change data, show flat line
  if (changePercent === null || changePercent === 0) {
    for (let i = 0; i < points; i++) {
      data.push({ value: currentValue })
    }
    return data
  }

  // Calculate starting value based on 7-day change
  const startValue = currentValue / (1 + changePercent / 100)

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    // Create smooth trend with slight randomness
    const trendValue = startValue + (currentValue - startValue) * progress
    const noise = (Math.random() - 0.5) * currentValue * 0.02 // ±2% noise
    data.push({
      value: Math.max(0, trendValue + noise),
    })
  }

  return data
}

interface HeroMetrics {
  estimatedValue: number
  invested: number
  unrealisedPL: number
  unrealisedPLDelta7d: number | null
  roi: number
  itemCount: number
  pricesAsOf: string
}

interface DashboardHeroProps {
  metrics: HeroMetrics
  loading?: boolean
}

export function DashboardHero({ metrics, loading = false }: DashboardHeroProps) {
  const { format } = useCurrency()

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="relative p-6 md:p-8 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

            <div className="relative space-y-4">
              <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-1/2 animate-pulse" />
              <div className="h-12 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-2/3 animate-pulse" />
              <div className="h-2 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-full animate-pulse" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const plPositive = metrics.unrealisedPL >= 0
  const roiPositive = metrics.roi >= 0

  // Clamp ROI for progress bar (between 5-100%)
  const roiProgress = Math.min(100, Math.max(5, Math.abs(metrics.roi)))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {/* Estimated Value */}
      <Card className="group relative p-6 md:p-8 bg-gradient-to-br from-accent/10 via-elev-2 to-elev-2 border-border/40 hover:border-accent/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(196,164,132,0.15)] hover:scale-[1.02] overflow-hidden">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Icon Badge */}
        <div className="relative flex items-start justify-between mb-4">
          <span className="text-xs text-neutral-400 uppercase tracking-[0.16em] font-semibold">Estimated Value</span>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Wallet className="h-5 w-5 text-accent" />
          </div>
        </div>

        <p className="relative text-[44px] md:text-[52px] leading-none font-bold text-neutral-50 mb-3 mono tabular-nums">
          {format(metrics.estimatedValue)}
        </p>

        <div className="relative space-y-1">
          <p className={cn(
            "text-sm font-semibold mono tabular-nums",
            plPositive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {plPositive ? '+' : ''}
            {format(metrics.unrealisedPL)} ({plPositive ? '+' : ''}
            {metrics.roi.toFixed(2)}%)
          </p>
          <p className="text-[11px] text-neutral-400 font-medium">
            Updated {formatRelativeTime(metrics.pricesAsOf)}
          </p>
        </div>

        {/* Mini sparkline - 7d trend */}
        <div className="relative mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={generateSparklineData(metrics.estimatedValue, metrics.unrealisedPLDelta7d)}
              margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
            >
              <Line
                type="monotone"
                dataKey="value"
                stroke={plPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)'}
                strokeWidth={2}
                dot={false}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Enhanced progress bar with gradient */}
        <div className="relative mt-2 h-2 w-full rounded-full bg-white/5 overflow-hidden shadow-inner">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              plPositive
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                : 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'
            )}
            style={{ width: `${roiProgress}%` }}
          />
        </div>
      </Card>

      {/* Invested */}
      <Card className="group relative p-6 md:p-8 bg-gradient-to-br from-blue-500/10 via-elev-2 to-elev-2 border-border/40 hover:border-blue-400/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(96,165,250,0.15)] hover:scale-[1.02] overflow-hidden">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Icon Badge */}
        <div className="relative flex items-start justify-between mb-4">
          <span className="text-xs text-neutral-400 uppercase tracking-[0.16em] font-semibold">Invested</span>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-400/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Package className="h-5 w-5 text-blue-400" />
          </div>
        </div>

        <p className="relative text-[44px] md:text-[52px] leading-none font-bold text-neutral-50 mb-3 mono tabular-nums">
          {format(metrics.invested)}
        </p>

        <div className="relative space-y-1">
          <p className="text-sm font-semibold text-blue-300 mono">
            {metrics.itemCount} {metrics.itemCount === 1 ? 'item' : 'items'}
          </p>
          <p className="text-[11px] text-neutral-400 font-medium">Total capital deployed</p>
        </div>

        {/* Mini sparkline - cumulative investment trend */}
        <div className="relative mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={generateSparklineData(metrics.invested, 5)} // Show ~5% growth over 7d
              margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
            >
              <Line
                type="monotone"
                dataKey="value"
                stroke="rgb(96, 165, 250)"
                strokeWidth={2}
                dot={false}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Enhanced progress bar with gradient (100% as it represents total) */}
        <div className="relative mt-2 h-2 w-full rounded-full bg-white/5 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]"
            style={{ width: '100%' }}
          />
        </div>
      </Card>

      {/* Unrealised P/L / Performance */}
      <Card className="group relative p-6 md:p-8 bg-gradient-to-br from-purple-500/10 via-elev-2 to-elev-2 border-border/40 hover:border-purple-400/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:scale-[1.02] overflow-hidden">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Icon Badge */}
        <div className="relative flex items-start justify-between mb-4">
          <span className="text-xs text-neutral-400 uppercase tracking-[0.16em] font-semibold">Unrealised P/L</span>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-400/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Target className="h-5 w-5 text-purple-400" />
          </div>
        </div>

        <p
          className={cn(
            'relative text-[44px] md:text-[52px] leading-none font-bold mb-3 mono tabular-nums',
            plPositive ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {plPositive ? '+' : ''}
          {format(metrics.unrealisedPL)}
        </p>

        <div className="relative space-y-1">
          <p className="text-sm font-semibold text-purple-300 mono">
            Performance: {roiPositive ? '+' : ''}
            {metrics.roi.toFixed(2)}%
          </p>
          {metrics.unrealisedPLDelta7d !== null && (
            <p className="text-[11px] text-neutral-400 font-medium">
              7d change: {metrics.unrealisedPLDelta7d >= 0 ? '+' : ''}
              {metrics.unrealisedPLDelta7d.toFixed(1)}%
            </p>
          )}
        </div>

        {/* Mini sparkline - 7d P/L trend */}
        <div className="relative mt-3 h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={generateSparklineData(Math.abs(metrics.unrealisedPL), metrics.unrealisedPLDelta7d)}
              margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
            >
              <Line
                type="monotone"
                dataKey="value"
                stroke={plPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)'}
                strokeWidth={2}
                dot={false}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Enhanced progress bar with gradient */}
        <div className="relative mt-2 h-2 w-full rounded-full bg-white/5 overflow-hidden shadow-inner">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              plPositive
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                : 'bg-gradient-to-r from-red-500 to-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'
            )}
            style={{ width: `${roiProgress}%` }}
          />
        </div>
      </Card>
    </div>
  )
}
