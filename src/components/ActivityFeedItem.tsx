'use client'

import { cn } from '@/lib/utils/cn'
import { gbp2 } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingCart, Tag, TrendingUp, TrendingDown, Bell, FileText } from 'lucide-react'

type ActivityType = 'purchase' | 'listing' | 'sale' | 'price_alert' | 'note'

export interface ActivityFeedItemProps {
  type: ActivityType
  title: string
  subtitle?: string
  timestampISO: string
  thumbUrl?: string
  amountGBP?: number
  deltaPct?: number
  tags?: string[]
  cta?: { label: string; onClick: () => void }
  highlight?: boolean
}

const formatRelativeTime = (isoString: string): string => {
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getTypeIcon = (type: ActivityType) => {
  switch (type) {
    case 'purchase':
      return <ShoppingCart className="h-5 w-5 text-accent" />
    case 'listing':
      return <Tag className="h-5 w-5 text-blue-400" />
    case 'sale':
      return <TrendingUp className="h-5 w-5 text-green-400" />
    case 'price_alert':
      return <Bell className="h-5 w-5 text-amber-400" />
    case 'note':
      return <FileText className="h-5 w-5 text-dim" />
  }
}

export function ActivityFeedItem({
  type,
  title,
  subtitle,
  timestampISO,
  thumbUrl,
  amountGBP,
  deltaPct,
  tags,
  cta,
  highlight = false,
}: ActivityFeedItemProps) {
  const relativeTime = formatRelativeTime(timestampISO)
  const hasDelta = deltaPct !== undefined && deltaPct !== 0
  const isPositive = deltaPct && deltaPct > 0
  const isNegative = deltaPct && deltaPct < 0

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all duration-120',
        highlight
          ? 'bg-elev-2 gradient-elev border-border'
          : 'bg-elev-1 border-border/40',
        cta && 'hover:bg-elev-2 cursor-pointer group'
      )}
      onClick={cta?.onClick}
      role={cta ? 'button' : undefined}
      tabIndex={cta ? 0 : undefined}
      onKeyDown={(e) => {
        if (cta && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          cta.onClick()
        }
      }}
    >
      {/* Left: Thumbnail or Icon */}
      <div className="shrink-0">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="h-10 w-10 rounded-lg object-cover bg-elev-3"
          />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-elev-3 flex items-center justify-center">
            {getTypeIcon(type)}
          </div>
        )}
      </div>

      {/* Middle: Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-col md:flex-row md:items-baseline md:gap-2">
          <h4 className="text-sm font-medium text-fg truncate">{title}</h4>
          {subtitle && (
            <span className="text-xs text-dim truncate">{subtitle}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <time className="text-xs font-mono text-dim">{relativeTime}</time>
          {tags && tags.length > 0 && (
            <>
              <span className="text-dim">•</span>
              <div className="flex gap-1 flex-wrap">
                {tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 border-border/60"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>

        {cta && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-120"
            onClick={(e) => {
              e.stopPropagation()
              cta.onClick()
            }}
          >
            {cta.label}
          </Button>
        )}
      </div>

      {/* Right: Amount and Delta */}
      {amountGBP !== undefined && (
        <div className="shrink-0 text-right space-y-0.5">
          <div className="text-sm font-mono font-medium text-fg">
            {gbp2.format(amountGBP)}
          </div>
          {hasDelta && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-mono',
                isPositive && 'text-green-400',
                isNegative && 'text-red-400'
              )}
            >
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {isNegative && <TrendingDown className="h-3 w-3" />}
              <span>
                {isPositive && '+'}
                {deltaPct?.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Skeleton component
export function ActivityFeedItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-elev-1 border border-border/40">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
