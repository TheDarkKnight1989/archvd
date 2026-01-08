/**
 * Recent Activity Component
 * Shows a compact list of recent sales for the Overview tab
 */

'use client'

import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SalesItem } from '@/hooks/useSalesTable'

interface RecentActivityProps {
  items: SalesItem[]
  loading: boolean
  onViewAll: () => void
  className?: string
}

// Normalize platform name for display
const getPlatformLabel = (platform: string | null | undefined): string => {
  if (!platform) return ''
  const lower = platform.toLowerCase()
  const labels: Record<string, string> = {
    stockx: 'StockX',
    alias: 'Alias',
    goat: 'Alias',
    ebay: 'eBay',
    private: 'Private',
  }
  return labels[lower] || platform
}

// Platform badge colors
const getPlatformColor = (platform: string | null | undefined): string => {
  if (!platform) return 'text-muted'
  const lower = platform.toLowerCase()
  const colors: Record<string, string> = {
    stockx: 'text-emerald-400',
    alias: 'text-purple-400',
    goat: 'text-purple-400',
    ebay: 'text-red-400',
    private: 'text-blue-400',
  }
  return colors[lower] || 'text-muted'
}

// Format relative date
const formatRelativeDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function RecentActivity({ items, loading, onViewAll, className }: RecentActivityProps) {
  const { convert, format } = useCurrency()

  if (loading) {
    return (
      <div className={cn('bg-elev-1 rounded-xl border border-border/30 p-4', className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn('bg-elev-1 rounded-xl border border-border/30 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted uppercase tracking-wide">
          Recent Activity
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewAll}
          className="h-7 text-xs text-accent hover:text-accent hover:bg-accent/10"
        >
          View All
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      <div className="divide-y divide-border/50">
        {items.map((item) => {
          const profit = item.margin_gbp || 0

          return (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Thumbnail */}
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover bg-elev-2"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-elev-2 flex items-center justify-center">
                    <span className="text-xs text-muted">?</span>
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0">
                  <div className="text-sm text-fg truncate font-medium">
                    {item.brand} {item.model}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{formatRelativeDate(item.sold_date)}</span>
                    {item.platform && (
                      <>
                        <span className="text-border">·</span>
                        <span className={getPlatformColor(item.platform)}>
                          {getPlatformLabel(item.platform)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Profit */}
              <div
                className="mono text-sm font-semibold whitespace-nowrap ml-3"
                style={{ color: profit >= 0 ? '#00FF94' : '#F87171' }}
              >
                {profit >= 0 ? '+' : ''}{format(convert(profit, 'GBP'))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
