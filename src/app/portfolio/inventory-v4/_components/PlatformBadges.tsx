'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/currency'
import type {
  InventoryV4Listing,
  ListingPlatform,
} from '@/lib/inventory-v4/types'
import { PLATFORM_CONFIG } from '@/lib/inventory-v4/types'

// =============================================================================
// PLATFORM BADGE - Single badge for one platform
// =============================================================================

interface PlatformBadgeProps {
  platform: ListingPlatform
  /** Optional custom name for custom platforms */
  platformName?: string | null
  /** Size variant */
  size?: 'sm' | 'md'
  /** Show just the badge without interactions */
  static?: boolean
}

export function PlatformBadge({
  platform,
  platformName,
  size = 'sm',
  static: isStatic = false,
}: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform]
  const label = platform === 'custom' && platformName ? platformName.slice(0, 2).toUpperCase() : config.label

  const badge = (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded',
        config.bgColor,
        config.textColor,
        size === 'sm' && 'h-5 min-w-[20px] px-1 text-[10px]',
        size === 'md' && 'h-6 min-w-[24px] px-1.5 text-xs'
      )}
    >
      {label}
    </span>
  )

  if (isStatic) return badge

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {platform === 'custom' ? platformName || 'Custom' : platform.charAt(0).toUpperCase() + platform.slice(1)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// =============================================================================
// LISTING BADGE - Badge showing listing price with hover details
// =============================================================================

interface ListingBadgeProps {
  listing: InventoryV4Listing
  size?: 'sm' | 'md'
}

export function ListingBadge({ listing, size = 'sm' }: ListingBadgeProps) {
  const config = PLATFORM_CONFIG[listing.platform]
  const label = listing.platform === 'custom' && listing.platform_name
    ? listing.platform_name.slice(0, 2).toUpperCase()
    : config.label

  const badge = (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded cursor-pointer transition-opacity hover:opacity-80',
        config.bgColor,
        config.textColor,
        size === 'sm' && 'h-5 min-w-[20px] px-1 text-[10px]',
        size === 'md' && 'h-6 min-w-[24px] px-1.5 text-xs'
      )}
    >
      {label}
    </span>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="p-0 overflow-hidden">
          <div className="min-w-[160px]">
            {/* Header */}
            <div className={cn('px-3 py-1.5 text-xs font-medium text-white', getPlatformHeaderBg(listing.platform))}>
              {listing.platform === 'custom'
                ? listing.platform_name || 'Custom'
                : listing.platform.charAt(0).toUpperCase() + listing.platform.slice(1)}
            </div>

            {/* Details */}
            <div className="px-3 py-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Listed:</span>
                <span className="font-medium">
                  {formatCurrency(listing.listed_price, listing.listed_currency)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={cn(
                  'font-medium capitalize',
                  listing.status === 'active' && 'text-emerald-500',
                  listing.status === 'paused' && 'text-amber-500',
                  listing.status === 'sold' && 'text-blue-500'
                )}>
                  {listing.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Since:</span>
                <span>{formatRelativeDate(listing.listed_at)}</span>
              </div>

              {listing.listing_url && (
                <a
                  href={listing.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center pt-1.5 text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Listing →
                </a>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// =============================================================================
// PLATFORM BADGES GROUP - Multiple badges for all active listings
// =============================================================================

interface PlatformBadgesProps {
  listings: InventoryV4Listing[]
  /** Maximum badges to show before +N */
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

export function PlatformBadges({
  listings,
  maxVisible = 3,
  size = 'sm',
  className,
}: PlatformBadgesProps) {
  // Only show active/paused listings
  const activeListings = (listings ?? []).filter(
    (l) => l.status === 'active' || l.status === 'paused'
  )

  if (activeListings.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    )
  }

  const visible = activeListings.slice(0, maxVisible)
  const hidden = activeListings.length - maxVisible

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {visible.map((listing) => (
        <ListingBadge key={listing.id} listing={listing} size={size} />
      ))}

      {hidden > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center justify-center font-medium rounded bg-zinc-500/10 text-zinc-500',
                  size === 'sm' && 'h-5 min-w-[20px] px-1 text-[10px]',
                  size === 'md' && 'h-6 min-w-[24px] px-1.5 text-xs'
                )}
              >
                +{hidden}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs space-y-1">
                {activeListings.slice(maxVisible).map((listing) => (
                  <div key={listing.id} className="flex items-center gap-2">
                    <PlatformBadge
                      platform={listing.platform}
                      platformName={listing.platform_name}
                      size="sm"
                      static
                    />
                    <span>
                      {formatCurrency(listing.listed_price, listing.listed_currency)}
                    </span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function getPlatformHeaderBg(platform: ListingPlatform): string {
  const colors: Record<ListingPlatform, string> = {
    stockx: 'bg-emerald-600',
    alias: 'bg-blue-600',
    ebay: 'bg-red-600',
    vinted: 'bg-teal-600',
    depop: 'bg-orange-600',
    tiktok: 'bg-zinc-800',
    instagram: 'bg-pink-600',
    shopify: 'bg-lime-600',
    custom: 'bg-zinc-600',
  }
  return colors[platform]
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}
