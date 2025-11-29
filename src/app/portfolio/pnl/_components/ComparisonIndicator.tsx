/**
 * Comparison Indicator Component
 * Shows period-over-period change with % and trend arrow
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { PeriodComparison } from '@/lib/pnl/comparison'

interface ComparisonIndicatorProps {
  comparison: PeriodComparison
  label?: string
  inverse?: boolean // For metrics where decrease is good (e.g., expenses)
  className?: string
}

export function ComparisonIndicator({
  comparison,
  label,
  inverse = false,
  className
}: ComparisonIndicatorProps) {
  const { changePercent, trend } = comparison

  // Determine if this is good or bad
  const isPositive = inverse ? trend === 'down' : trend === 'up'
  const isNegative = inverse ? trend === 'up' : trend === 'down'

  if (trend === 'neutral') {
    return (
      <div className={cn('inline-flex items-center gap-1 text-xs text-dim', className)}>
        <Minus className="h-3 w-3" />
        <span>0%</span>
        {label && <span>{label}</span>}
      </div>
    )
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-1 text-xs font-medium',
      isPositive && 'text-[#00FF94]',
      isNegative && 'text-red-400',
      className
    )}>
      {trend === 'up' && <TrendingUp className="h-3 w-3" />}
      {trend === 'down' && <TrendingDown className="h-3 w-3" />}
      <span>{changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%</span>
      {label && <span className="text-dim">{label}</span>}
    </div>
  )
}
