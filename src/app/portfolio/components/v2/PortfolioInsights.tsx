'use client'

import { TrendingUp, Lightbulb, AlertCircle, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import type { Mover } from '@/hooks/useDashboardMovers'

interface PortfolioInsightsProps {
  movers: Mover[]
  metrics: {
    estimatedValue: number
    unrealisedPL: number
    roi: number
    unrealisedPLDelta7d: number | null
  }
}

interface Insight {
  id: string
  type: 'opportunity' | 'warning' | 'trend'
  title: string
  description: string
  action?: {
    label: string
    href?: string
  }
  icon: React.ElementType
  colorClass: string
  bgClass: string
}

export function PortfolioInsights({ movers, metrics }: PortfolioInsightsProps) {
  const { format } = useCurrency()

  // Generate insights based on actual data
  const insights: Insight[] = []

  // Insight 1: Hot items to list
  const hotItems = movers.filter((m) => m.performance_pct >= 15).slice(0, 3)
  if (hotItems.length > 0) {
    insights.push({
      id: 'hot-items',
      type: 'opportunity',
      title: `${hotItems.length} item${hotItems.length > 1 ? 's' : ''} up 15%+ this week`,
      description: hotItems.map((m) => `${m.brand} ${m.model}`).join(', '),
      action: {
        label: 'View Items',
        href: '/portfolio/inventory',
      },
      icon: TrendingUp,
      colorClass: 'text-emerald-400',
      bgClass: 'from-emerald-500/10 to-emerald-500/5',
    })
  }

  // Insight 2: Portfolio performance trend
  if (metrics.unrealisedPLDelta7d !== null && Math.abs(metrics.unrealisedPLDelta7d) >= 5) {
    const isPositive = metrics.unrealisedPLDelta7d >= 0
    insights.push({
      id: 'portfolio-trend',
      type: isPositive ? 'trend' : 'warning',
      title: `Portfolio ${isPositive ? 'gaining' : 'declining'} ${Math.abs(metrics.unrealisedPLDelta7d).toFixed(1)}% (7d)`,
      description: isPositive
        ? 'Strong upward trend - consider scaling positions'
        : 'Market softening - monitor closely for exit opportunities',
      icon: isPositive ? Sparkles : AlertCircle,
      colorClass: isPositive ? 'text-accent' : 'text-orange-400',
      bgClass: isPositive ? 'from-accent/10 to-accent/5' : 'from-orange-500/10 to-orange-500/5',
    })
  }

  // Insight 3: ROI milestone
  if (metrics.roi >= 20) {
    insights.push({
      id: 'roi-milestone',
      type: 'trend',
      title: `${metrics.roi.toFixed(1)}% portfolio ROI`,
      description: 'Exceptional performance - well above market average',
      icon: Sparkles,
      colorClass: 'text-accent',
      bgClass: 'from-accent/10 to-accent/5',
    })
  } else if (metrics.roi >= 10) {
    insights.push({
      id: 'roi-milestone',
      type: 'trend',
      title: `${metrics.roi.toFixed(1)}% portfolio ROI`,
      description: 'Strong performance - on track for growth',
      icon: TrendingUp,
      colorClass: 'text-emerald-400',
      bgClass: 'from-emerald-500/10 to-emerald-500/5',
    })
  }

  // Insight 4: Top mover highlight
  if (movers.length > 0 && movers[0].performance_pct >= 10) {
    const topMover = movers[0]
    insights.push({
      id: 'top-mover',
      type: 'opportunity',
      title: `${topMover.brand} ${topMover.model} is your top performer`,
      description: `Up ${topMover.performance_pct.toFixed(1)}% - consider listing at ${format(topMover.market_value * 1.05)}`,
      action: {
        label: 'List Now',
      },
      icon: Lightbulb,
      colorClass: 'text-blue-400',
      bgClass: 'from-blue-500/10 to-blue-500/5',
    })
  }

  // Only show if we have insights
  if (insights.length === 0) {
    return null
  }

  return (
    <Card className="relative p-5 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 hover:border-accent/30 transition-all duration-300 overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-50 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-center">
          <Lightbulb className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-50">Portfolio Insights</h3>
          <p className="text-[10px] text-neutral-400">AI-powered recommendations</p>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight) => {
          const Icon = insight.icon
          return (
            <div
              key={insight.id}
              className={cn(
                'group relative p-4 rounded-lg border border-border/30 transition-all duration-300 cursor-pointer',
                `bg-gradient-to-br ${insight.bgClass}`,
                'hover:border-accent/40 hover:shadow-[0_0_20px_rgba(196,164,132,0.1)] hover:scale-[1.02]'
              )}
            >
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className={cn('h-4 w-4', insight.colorClass)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn('text-sm font-semibold mb-1', insight.colorClass)}>{insight.title}</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">{insight.description}</p>

                  {/* Action button */}
                  {insight.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-7 text-[10px] font-semibold text-accent hover:text-accent hover:bg-accent/10 border border-accent/30 hover:border-accent/50 transition-all px-3"
                    >
                      {insight.action.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
