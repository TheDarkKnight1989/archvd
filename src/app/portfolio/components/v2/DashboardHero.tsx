'use client'

import { TrendingUp, TrendingDown, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { formatRelativeTime } from '@/lib/utils/formatRelativeTime'

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
          <Card key={i} className="p-6 md:p-8 bg-elev-2 border-border/40 animate-pulse">
            <div className="h-4 bg-elev-1 rounded w-1/2 mb-4" />
            <div className="h-10 bg-elev-1 rounded w-3/4 mb-3" />
            <div className="h-3 bg-elev-1 rounded w-2/3" />
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
      <Card className="p-6 md:p-8 bg-elev-2 border-border/40 hover:border-border/60 transition-colors">
        <span className="text-xs text-neutral-400 uppercase tracking-[0.16em]">Estimated Value</span>
        <p className="text-[40px] md:text-[48px] leading-none font-semibold text-neutral-50 mt-2 mb-2 mono tabular-nums">
          {format(metrics.estimatedValue)}
        </p>
        <p className="text-[11px] text-neutral-300">
          {plPositive ? '+' : ''}
          {format(metrics.unrealisedPL)} ({plPositive ? '+' : ''}
          {metrics.roi.toFixed(2)}%)
        </p>
        <p className="text-[11px] text-neutral-400 font-medium mt-1">
          {formatRelativeTime(metrics.pricesAsOf)}
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              plPositive ? 'bg-emerald-500/80' : 'bg-red-500/80'
            )}
            style={{ width: `${roiProgress}%` }}
          />
        </div>
      </Card>

      {/* Invested */}
      <Card className="p-6 md:p-8 bg-elev-2 border-border/40 hover:border-border/60 transition-colors">
        <span className="text-xs text-neutral-400 uppercase tracking-[0.16em]">Invested</span>
        <p className="text-[40px] md:text-[48px] leading-none font-semibold text-neutral-50 mt-2 mb-2 mono tabular-nums">
          {format(metrics.invested)}
        </p>
        <p className="text-[11px] text-neutral-300">
          {metrics.itemCount} {metrics.itemCount === 1 ? 'item' : 'items'}
        </p>
        <p className="text-[11px] text-neutral-400 font-medium mt-1">Total capital deployed</p>

        {/* Progress bar (100% as it represents total) */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-accent/60"
            style={{ width: '100%' }}
          />
        </div>
      </Card>

      {/* Unrealised P/L / Performance */}
      <Card className="p-6 md:p-8 bg-elev-2 border-border/40 hover:border-border/60 transition-colors">
        <span className="text-xs text-neutral-400 uppercase tracking-[0.16em]">Unrealised P/L</span>
        <p
          className={cn(
            'text-[40px] md:text-[48px] leading-none font-semibold mt-2 mb-2 mono tabular-nums',
            plPositive ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {plPositive ? '+' : ''}
          {format(metrics.unrealisedPL)}
        </p>
        <p className="text-[11px] text-neutral-300">
          Performance: {roiPositive ? '+' : ''}
          {metrics.roi.toFixed(2)}%
        </p>
        {metrics.unrealisedPLDelta7d !== null && (
          <p className="text-[11px] text-neutral-400 font-medium mt-1">
            7d change: {metrics.unrealisedPLDelta7d >= 0 ? '+' : ''}
            {metrics.unrealisedPLDelta7d.toFixed(1)}%
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              plPositive ? 'bg-emerald-500/80' : 'bg-red-500/80'
            )}
            style={{ width: `${roiProgress}%` }}
          />
        </div>
      </Card>
    </div>
  )
}
