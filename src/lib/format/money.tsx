import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * Format currency with optional color coding for gains/losses
 */
export function formatMoney(value: number, currency: string = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format percentage with optional decimal places
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Render money with green/red color coding and optional trend arrow
 * Used for margin, profit/loss columns
 */
export function MoneyCell({
  value,
  showArrow = false,
  currency = 'GBP',
}: {
  value: number | null | undefined
  showArrow?: boolean
  currency?: string
}) {
  if (value === null || value === undefined) {
    return <span className="text-[#7FA08F]">—</span>
  }

  const isPositive = value >= 0

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {showArrow && (
        <>
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" style={{ color: '#22DA6E' }} />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" style={{ color: '#FF4D5E' }} />
          )}
        </>
      )}
      <span className="text-sm font-mono font-semibold" style={{ color: isPositive ? '#22DA6E' : '#FF4D5E' }}>
        {value >= 0 && '+'}
        {formatMoney(value, currency)}
      </span>
    </div>
  )
}

/**
 * Render percentage with green/red color coding
 * Used for margin %, gain/loss %
 */
export function PercentCell({
  value,
}: {
  value: number | null | undefined
}) {
  if (value === null || value === undefined) {
    return <span className="text-[#7FA08F]">—</span>
  }

  const isPositive = value >= 0

  return (
    <span className="text-sm font-mono font-semibold" style={{ color: isPositive ? '#22DA6E' : '#FF4D5E' }}>
      {formatPercent(value)}
    </span>
  )
}

/**
 * Render plain money value (no color coding)
 * Used for purchase price, total, etc.
 */
export function PlainMoneyCell({
  value,
  currency = 'GBP',
}: {
  value: number | null | undefined
  currency?: string
}) {
  if (value === null || value === undefined) {
    return <span className="text-[#7FA08F]">—</span>
  }

  return (
    <span className="text-sm font-mono text-[#E8F6EE]">
      {formatMoney(value, currency)}
    </span>
  )
}
