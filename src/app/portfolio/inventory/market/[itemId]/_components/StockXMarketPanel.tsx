'use client'

/**
 * StockXMarketPanel - Display StockX market data
 *
 * Shows:
 * - Lowest Ask
 * - Highest Bid
 * - Sales Last 72h
 * - Last Sync timestamp
 * - Mapping status
 */

import { TrendingUp, TrendingDown, Activity, DollarSign, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { PlainMoneyCell } from '@/lib/format/money'
import { cn } from '@/lib/utils/cn'

interface StockXMarketPanelProps {
  item: any
}

export function StockXMarketPanel({ item }: StockXMarketPanelProps) {
  const stockx = item.stockx || {}
  const hasMapping = stockx.mapped && stockx.productId && stockx.variantId
  const lowestAsk = stockx.lowestAsk
  const highestBid = stockx.highestBid
  const salesLast72h = stockx.salesLast72Hours
  const lastSyncAt = stockx.lastSyncSuccessAt

  const formatSyncTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never synced'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">StockX Market Data</h3>
          <PlatformBadge platform="stockx" />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!hasMapping ? (
        <div className="py-8 text-center">
          <Activity className="h-12 w-12 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm mb-2">Not mapped to StockX</p>
          <Button variant="outline" size="sm">
            Map to StockX
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Market Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Lowest Ask */}
            <div className="p-4 bg-soft/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <TrendingDown className="h-3.5 w-3.5" />
                <span>Lowest Ask</span>
              </div>
              {lowestAsk ? (
                <div className="text-xl font-bold mono text-fg">
                  <PlainMoneyCell value={lowestAsk} currency="USD" />
                </div>
              ) : (
                <div className="text-muted">—</div>
              )}
            </div>

            {/* Highest Bid */}
            <div className="p-4 bg-soft/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 text-muted text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Highest Bid</span>
              </div>
              {highestBid ? (
                <div className="text-xl font-bold mono text-fg">
                  <PlainMoneyCell value={highestBid} currency="USD" />
                </div>
              ) : (
                <div className="text-muted">—</div>
              )}
            </div>
          </div>

          {/* Sales Volume */}
          {salesLast72h !== null && salesLast72h !== undefined && (
            <div className="p-4 bg-soft/50 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted text-sm">Sales (Last 72h)</span>
                <span className="text-lg font-bold mono">{salesLast72h}</span>
              </div>
            </div>
          )}

          {/* Sync Status */}
          <div className="pt-3 border-t border-border text-xs text-muted flex items-center justify-between">
            <span>Last synced: {formatSyncTime(lastSyncAt)}</span>
            {stockx.mappingStatus && (
              <Badge variant="outline" className="text-xs">
                {stockx.mappingStatus}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
