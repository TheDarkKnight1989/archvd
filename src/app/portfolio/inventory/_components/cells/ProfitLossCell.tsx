'use client'

import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'

export interface ProfitLossCellProps {
  value: number | null | undefined
}

/**
 * ProfitLossCell - P/L value with green (profit) or red (loss) coloring
 * WHY: Visual indicator of item performance
 */
export function ProfitLossCell({ value }: ProfitLossCellProps) {
  const { format } = useCurrency()

  if (value == null) {
    return (
      <div className="text-right">
        <div className="text-sm text-dim mono">—</div>
      </div>
    )
  }

  const isProfit = value >= 0
  const colorClass = isProfit ? 'text-[#16A34A]' : 'text-[#DC2626]' // green-600 : red-600

  return (
    <div className="text-right">
      <div className={cn('text-sm font-medium mono tabular-nums', colorClass)}>
        {isProfit && value > 0 ? '+' : ''}
        {format(value)}
      </div>
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function ProfitLossCellSkeleton() {
  return (
    <div className="text-right">
      <div className="h-4 w-16 bg-elev-2 animate-pulse rounded ml-auto" />
    </div>
  )
}
