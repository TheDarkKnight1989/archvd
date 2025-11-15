'use client'

import { cn } from '@/lib/utils/cn'

export interface PerformanceCellProps {
  value: number | null | undefined
}

/**
 * PerformanceCell - Performance percentage with green (gain) or red (loss) coloring
 * WHY: Show % gain/loss for at-a-glance performance assessment
 */
export function PerformanceCell({ value }: PerformanceCellProps) {
  if (value == null) {
    return (
      <div className="text-right">
        <div className="text-sm text-dim mono">—</div>
      </div>
    )
  }

  const isGain = value >= 0
  const colorClass = isGain ? 'text-[#16A34A]' : 'text-[#DC2626]' // green-600 : red-600

  return (
    <div className="text-right">
      <div className={cn('text-sm font-medium mono tabular-nums', colorClass)}>
        {isGain && value > 0 ? '+' : ''}
        {value.toFixed(1)}%
      </div>
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function PerformanceCellSkeleton() {
  return (
    <div className="text-right">
      <div className="h-4 w-12 bg-elev-2 animate-pulse rounded ml-auto" />
    </div>
  )
}
