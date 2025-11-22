'use client'

/**
 * ListingPlatformPanel - Listing status and platform info
 *
 * Shows:
 * - Listing status
 * - Platform (if listed)
 * - Listing ID
 * - Expires At
 * - Created At
 * - Quick actions (Delist, Reprice, etc.)
 */

import { ExternalLink, Calendar, Tag, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { cn } from '@/lib/utils/cn'

interface ListingPlatformPanelProps {
  item: any
}

export function ListingPlatformPanel({ item }: ListingPlatformPanelProps) {
  const stockx = item.stockx || {}
  const isListed = !!stockx.listingId && stockx.listingStatus === 'ACTIVE'
  const listingStatus = stockx.listingStatus || 'INACTIVE'
  const expiresAt = stockx.expiresAt
  const createdAt = item.created_at

  const statusColors = {
    ACTIVE: 'bg-green-500/10 text-green-500 border-green-500/30',
    INACTIVE: 'bg-muted/10 text-muted border-muted/30',
    PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    CANCELLED: 'bg-red-500/10 text-red-500 border-red-500/30',
    SOLD: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-lg font-semibold mb-4">Listing & Platform Info</h3>

      {!isListed ? (
        <div className="py-6 text-center">
          <AlertCircle className="h-10 w-10 text-muted mx-auto mb-2" />
          <p className="text-muted text-sm mb-4">Not currently listed</p>
          <Button variant="outline" size="sm">
            List on StockX
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status & Platform */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Status</span>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('text-xs', statusColors[listingStatus as keyof typeof statusColors] || '')}
              >
                {listingStatus}
              </Badge>
              <PlatformBadge platform="stockx" />
            </div>
          </div>

          {/* Listing ID */}
          {stockx.listingId && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Listing ID</span>
              <span className="text-sm font-mono">{stockx.listingId.slice(0, 12)}...</span>
            </div>
          )}

          {/* Expires At */}
          {expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Expires At
              </span>
              <span className="text-sm font-mono">{formatDate(expiresAt)}</span>
            </div>
          )}

          {/* Created At */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Created</span>
            <span className="text-sm font-mono">{formatDate(createdAt)}</span>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              Reprice
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-red-500">
              Delist
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
