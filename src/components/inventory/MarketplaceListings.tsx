'use client'

import { cn } from '@/lib/utils/cn'

export type MarketplaceStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'NONE'

export interface MarketplaceListing {
  marketplace: 'stockx' | 'goat' | 'ebay' | 'klekt' | 'alias'
  status: MarketplaceStatus
  askPrice?: number
  currency?: string
  expiresAt?: string
}

interface MarketplaceListingsProps {
  listings: MarketplaceListing[]
  className?: string
  compact?: boolean
}

const MARKETPLACE_CONFIG = {
  stockx: {
    name: 'StockX',
    shortName: 'Sx',
    color: 'money-pos-tint',
    borderColor: 'border-profit/30',
  },
  goat: {
    name: 'GOAT',
    shortName: 'Gt',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500/30',
  },
  ebay: {
    name: 'eBay',
    shortName: 'Eb',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    borderColor: 'border-yellow-500/30',
  },
  klekt: {
    name: 'Klekt',
    shortName: 'Kl',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500/30',
  },
  alias: {
    name: 'Alias',
    shortName: 'As',
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    borderColor: 'border-indigo-500/30',
  },
}

const STATUS_INDICATOR = {
  ACTIVE: {
    icon: '●',
    color: 'text-emerald-500',
    label: 'Active',
  },
  PENDING: {
    icon: '○',
    color: 'text-amber-500',
    label: 'Pending',
  },
  INACTIVE: {
    icon: '◐',
    color: 'text-slate-400',
    label: 'Inactive',
  },
  NONE: {
    icon: '—',
    color: 'text-muted',
    label: 'Not listed',
  },
}

export function MarketplaceListings({ listings, className, compact = false }: MarketplaceListingsProps) {
  if (listings.length === 0) {
    return (
      <div className={cn('text-sm text-dim', className)}>
        Not listed
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {listings.map((listing) => {
          const config = MARKETPLACE_CONFIG[listing.marketplace]
          const statusConfig = STATUS_INDICATOR[listing.status]

          return (
            <div
              key={listing.marketplace}
              className="group relative flex items-center"
              title={`${config.name}: ${statusConfig.label}`}
            >
              {/* Marketplace Badge */}
              <div
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold border',
                  config.color,
                  config.borderColor
                )}
              >
                {config.shortName}
              </div>

              {/* Status Indicator Dot */}
              {listing.status !== 'NONE' && (
                <div
                  className={cn(
                    'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
                    statusConfig.color === 'text-emerald-500' && 'bg-emerald-500',
                    statusConfig.color === 'text-amber-500' && 'bg-amber-500',
                    statusConfig.color === 'text-slate-400' && 'bg-slate-400'
                  )}
                />
              )}

              {/* Tooltip on hover */}
              {listing.status !== 'NONE' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div className="bg-surface border border-border rounded-lg px-2.5 py-1.5 shadow-medium whitespace-nowrap">
                    <div className="text-2xs text-fg font-semibold mb-1">{config.name}</div>
                    <div className="text-2xs space-y-0.5">
                      <div className="text-dim">Status: <span className={statusConfig.color}>{statusConfig.label}</span></div>
                      {listing.askPrice && (
                        <div className="text-dim">
                          Ask: <span className="font-mono">{listing.currency || '£'}{listing.askPrice}</span>
                        </div>
                      )}
                      {listing.expiresAt && (
                        <div className="text-dim text-[10px]">
                          Expires: {new Date(listing.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Non-compact view: Show detailed listing cards
  return (
    <div className={cn('space-y-2', className)}>
      {listings.map((listing) => {
        const config = MARKETPLACE_CONFIG[listing.marketplace]
        const statusConfig = STATUS_INDICATOR[listing.status]

        return (
          <div
            key={listing.marketplace}
            className={cn(
              'flex items-center justify-between gap-3 px-3 py-2 rounded-lg border',
              config.color,
              config.borderColor
            )}
          >
            {/* Left: Marketplace Name + Badge */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold">
                {config.shortName}
              </div>
              <span className="text-sm font-medium">{config.name}</span>
            </div>

            {/* Right: Status + Price */}
            <div className="flex items-center gap-2">
              {listing.askPrice && (
                <span className="text-sm font-mono font-semibold">
                  {listing.currency || '£'}{listing.askPrice}
                </span>
              )}
              <span className={cn('text-xs', statusConfig.color)}>
                {statusConfig.icon} {statusConfig.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
