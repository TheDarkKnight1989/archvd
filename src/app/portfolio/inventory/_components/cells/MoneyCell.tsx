'use client'

import { useCurrency } from '@/hooks/useCurrency'

export interface MoneyCellProps {
  value: number | null | undefined
  subtitle?: string // e.g., "avg £42.50" for invested column
}

/**
 * MoneyCell - Right-aligned money value with optional subtitle
 * WHY: Consistent money formatting across all columns
 */
export function MoneyCell({ value, subtitle }: MoneyCellProps) {
  const { format } = useCurrency()

  return (
    <div className="text-right space-y-0.5">
      <div className="text-sm font-medium text-fg mono tabular-nums">
        {value != null ? format(value) : '—'}
      </div>
      {subtitle && (
        <div className="text-2xs text-dim mono">
          {subtitle}
        </div>
      )}
    </div>
  )
}

/**
 * QtyCell - Simple quantity display
 */
export function QtyCell({ value }: { value: number }) {
  return (
    <div className="text-center">
      <div className="text-sm font-medium text-fg mono tabular-nums">
        {value}
      </div>
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function MoneyCellSkeleton() {
  return (
    <div className="text-right space-y-0.5">
      <div className="h-4 w-16 bg-elev-2 animate-pulse rounded ml-auto" />
    </div>
  )
}
