'use client'

import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { formatDistanceToNow } from 'date-fns'

export interface MarketPriceCellProps {
  price: number | null | undefined
  currency?: 'GBP' | 'EUR' | 'USD' | null
  provider: 'stockx' | 'alias' | 'ebay' | 'seed' | null | undefined
  updatedAt: string | null | undefined
}

/**
 * MarketPriceCell - Market price with provider badge and time ago
 * WHY: Show price provenance (source + freshness) for trust
 */
export function MarketPriceCell({ price, currency, provider, updatedAt }: MarketPriceCellProps) {
  const { format } = useCurrency()

  if (!price) {
    return (
      <div className="text-right">
        <div className="text-sm text-dim mono">—</div>
      </div>
    )
  }

  // Use the currency from the data (no conversion needed - API returned it in this currency)
  const displayCurrency = currency || 'GBP'

  const timeAgo = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
    : null

  return (
    <div className="text-right space-y-1">
      {/* Price */}
      <div className="text-sm font-medium text-fg mono tabular-nums">
        {format(price, displayCurrency)}
      </div>

      {/* Provenance: Provider badge + time ago */}
      {provider && (
        <div className="flex items-center justify-end gap-1.5">
          {/* Provider badge */}
          <div
            className={cn(
              'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
              provider === 'stockx' && 'bg-green-500/10 text-green-600 border border-green-500/20',
              provider === 'alias' && 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
              provider === 'ebay' && 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
              provider === 'seed' && 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
            )}
          >
            {provider}
          </div>

          {/* Time ago */}
          {timeAgo && (
            <span className="text-2xs text-dim mono" title={updatedAt || undefined}>
              {timeAgo}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function MarketPriceCellSkeleton() {
  return (
    <div className="text-right space-y-1">
      <div className="h-4 w-16 bg-elev-2 animate-pulse rounded ml-auto" />
      <div className="h-3 w-20 bg-elev-2 animate-pulse rounded ml-auto" />
    </div>
  )
}
