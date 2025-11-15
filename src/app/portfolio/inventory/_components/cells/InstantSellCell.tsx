/**
 * Instant Sell Cell - Display highest bid with fee breakdown tooltip
 * WHY: Show instant sell price (highest bid) with net payout after fees
 */

import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from 'date-fns'

interface InstantSellCellProps {
  gross: number | null      // Highest bid (raw)
  net: number | null         // After fees
  currency?: 'GBP' | 'EUR' | 'USD' | null
  provider?: 'stockx' | null
  updatedAt?: string | null
  feePct: number             // Fee percentage (e.g., 0.10 = 10%)
  className?: string
}

export function InstantSellCell({
  gross,
  net,
  currency,
  provider,
  updatedAt,
  feePct,
  className
}: InstantSellCellProps) {
  const { format } = useCurrency()

  // Empty state
  if (!gross || !net) {
    return (
      <div className={cn('text-right font-mono text-sm text-muted', className)}>
        —
      </div>
    )
  }

  // Use the currency from the data (no conversion needed - API returned it in this currency)
  const displayCurrency = currency || 'GBP'

  // Check if data is stale (>12 hours)
  const isStale = updatedAt ?
    (Date.now() - new Date(updatedAt).getTime()) > 12 * 60 * 60 * 1000 :
    false

  // Time ago text
  const timeAgo = updatedAt ?
    formatDistanceToNow(new Date(updatedAt), { addSuffix: false }) :
    null

  // Tooltip content
  const tooltipContent = `Highest bid: ${format(gross, displayCurrency)}
Estimated payout (-${(feePct * 100).toFixed(0)}%): ${format(net, displayCurrency)}
Provider: ${provider?.toUpperCase() || 'Unknown'}`

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 text-sm',
        className
      )}
      title={tooltipContent}
    >
      {/* Provider badge + time ago */}
      {provider === 'stockx' && timeAgo && (
        <div className="flex items-center gap-1 text-xs text-muted">
          <span className="font-semibold">Sx</span>
          <span>•</span>
          <span>{timeAgo.replace(' ago', '')}</span>
        </div>
      )}

      {/* Gross amount */}
      <div
        className={cn(
          'font-mono font-medium tabular-nums text-right',
          isStale ? 'text-muted' : 'text-fg'
        )}
      >
        {format(gross, displayCurrency)}
      </div>
    </div>
  )
}
