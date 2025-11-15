'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils/cn'
import type { Provider } from '@/types/product'
import { formatRelativeTime, formatExactTime, getProviderDisplayName } from '@/lib/utils/provenance'

export type ProvenanceBadgeProps = {
  provider: Provider
  timestamp: string
  className?: string
  variant?: 'default' | 'compact'
}

/**
 * ProvenanceBadge - Shows market price attribution
 *
 * Displays: "stockx • 2h ago" with tooltip showing exact timestamp
 *
 * Usage:
 * <ProvenanceBadge provider="stockx" timestamp="2025-01-14T12:00:00Z" />
 */
export function ProvenanceBadge({
  provider,
  timestamp,
  className,
  variant = 'default',
}: ProvenanceBadgeProps) {
  const displayName = getProviderDisplayName(provider)
  const relativeTime = formatRelativeTime(timestamp)
  const exactTime = formatExactTime(timestamp)

  // Provider-specific styling
  const providerStyles: Record<Provider, string> = {
    stockx: 'text-profit border-profit/30',
    alias: 'text-accent border-accent/30',
    ebay: 'text-blue-500 border-blue-500/30',
    seed: 'text-dim border-border',
  }

  const providerClass = providerStyles[provider] || 'text-muted border-border'

  if (variant === 'compact') {
    return (
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div className={cn('inline-flex items-center gap-1 text-2xs', providerClass, className)}>
              {provider === 'stockx' && (
                <div className="inline-flex items-center justify-center w-3 h-3 rounded bg-profit/20 text-profit text-[8px] font-bold border border-profit/30">
                  Sx
                </div>
              )}
              <span className="mono">{relativeTime}</span>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="bg-elev-3 border border-border px-2.5 py-1.5 rounded-lg text-xs text-fg shadow-lg z-50"
              sideOffset={5}
            >
              <div>
                <div className="font-medium">{displayName}</div>
                <div className="text-dim mono mt-0.5">{exactTime}</div>
              </div>
              <Tooltip.Arrow className="fill-elev-3" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-2xs font-medium mono',
              providerClass,
              className
            )}
          >
            {provider === 'stockx' && (
              <div className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-profit/20 text-profit text-[9px] font-bold border border-profit/30">
                Sx
              </div>
            )}
            <span className="lowercase">{displayName}</span>
            <span className="text-dim">•</span>
            <span>{relativeTime}</span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-elev-3 border border-border px-2.5 py-1.5 rounded-lg text-xs text-fg shadow-lg z-50"
            sideOffset={5}
          >
            <div>
              <div className="font-medium">Market price from {displayName}</div>
              <div className="text-dim mono mt-0.5">Updated: {exactTime}</div>
            </div>
            <Tooltip.Arrow className="fill-elev-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

/**
 * Skeleton variant for loading states
 */
ProvenanceBadge.Skeleton = function ProvenanceBadgeSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-elev-2 animate-pulse',
        className
      )}
    >
      <div className="h-2.5 w-16 bg-elev-3 rounded" />
    </div>
  )
}

export default ProvenanceBadge
