'use client'

/**
 * SizeRunComparisonTable - StockX vs Alias size run comparison
 * Shows side-by-side pricing data from both platforms
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatMoney } from '@/lib/format/money'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { Badge } from '@/components/ui/badge'

interface SizeRunComparisonTableProps {
  variants: Array<{
    size: number
    stockxAsk: number | null // GBP
    stockxBid: number | null // GBP
    aliasAsk: number | null // USD
    aliasBid: number | null // USD
    average: number | null // GBP
  }>
  userSizeUS?: number | null
  stockxDataIsStale?: boolean
  stockxRefreshError?: string | null
}

export function SizeRunComparisonTable({
  variants,
  userSizeUS,
  stockxDataIsStale = false,
  stockxRefreshError = null
}: SizeRunComparisonTableProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const tableBodyRef = useRef<HTMLDivElement>(null)
  const userRowRef = useRef<HTMLTableRowElement>(null)

  // Auto-scroll to user's size on mount
  useEffect(() => {
    if (isExpanded && userSizeUS && userRowRef.current && tableBodyRef.current) {
      setTimeout(() => {
        if (userRowRef.current && tableBodyRef.current) {
          const rowTop = userRowRef.current.offsetTop
          const rowHeight = userRowRef.current.offsetHeight
          const containerHeight = tableBodyRef.current.offsetHeight
          const scrollTo = rowTop - (containerHeight / 2) + (rowHeight / 2)
          tableBodyRef.current.scrollTop = Math.max(0, scrollTo)
        }
      }, 100)
    }
  }, [isExpanded, userSizeUS])

  if (variants.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-soft">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-semibold text-fg tracking-tight">
            Size Run: StockX vs Alias
          </h3>
          <div className="flex items-center gap-2">
            <PlatformBadge platform="stockx" size="sm" />
            <PlatformBadge platform="alias" size="sm" />
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-muted hover:text-fg transition-colors flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              Hide
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {/* Subtitle */}
      {isExpanded && (
        <div className="px-6 py-2 bg-soft/30 border-b border-border/50">
          <p className="text-xs text-muted">
            StockX in GBP · Alias in USD
          </p>
        </div>
      )}

      {/* Stale data notice */}
      {isExpanded && stockxDataIsStale && (
        <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ Using last synced StockX data (stale)
            {stockxRefreshError && (
              <span className="ml-1 text-yellow-700 dark:text-yellow-500">
                · {stockxRefreshError}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Collapsible table */}
      {isExpanded && (
        <div
          ref={tableBodyRef}
          className="relative max-h-[320px] overflow-y-auto"
        >
          <table className="w-full">
            {/* Sticky header */}
            <thead className="sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2.5 label-up text-left">Size</th>
                <th className="px-4 py-2.5 label-up text-right">Average</th>
                <th className="px-4 py-2.5 label-up text-right">StockX Ask</th>
                <th className="px-4 py-2.5 label-up text-right">StockX Bid</th>
                <th className="px-4 py-2.5 label-up text-right">Alias Ask</th>
                <th className="px-4 py-2.5 label-up text-right">Alias Bid</th>
              </tr>
            </thead>

            {/* Table body */}
            <tbody className="divide-y divide-border/48">
              {variants.map((variant, index) => {
                const isUserSize = userSizeUS && variant.size === userSizeUS

                return (
                  <tr
                    key={variant.size}
                    ref={isUserSize ? userRowRef : undefined}
                    className={cn(
                      'min-h-12 transition-boutique',
                      index % 2 === 0 ? 'bg-table-zebra' : 'bg-panel',
                      isUserSize && 'bg-accent/10 ring-1 ring-inset ring-accent/20'
                    )}
                  >
                    {/* Size */}
                    <td className="px-4 py-3 text-sm text-fg">
                      <div className="flex items-center gap-2">
                        <span className={cn(isUserSize && 'font-semibold')}>
                          US {variant.size}
                        </span>
                        {isUserSize && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0 h-5 bg-accent/10 border-accent/30 text-accent"
                          >
                            Your size
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Average */}
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-fg">
                        {variant.average !== null
                          ? formatMoney(variant.average, 'GBP')
                          : '—'}
                      </span>
                    </td>

                    {/* StockX Ask */}
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-yellow-600 dark:text-yellow-400">
                        {variant.stockxAsk !== null
                          ? formatMoney(variant.stockxAsk, 'GBP')
                          : '—'}
                      </span>
                    </td>

                    {/* StockX Bid */}
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-fg">
                        {variant.stockxBid !== null
                          ? formatMoney(variant.stockxBid, 'GBP')
                          : '—'}
                      </span>
                    </td>

                    {/* Alias Ask */}
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-yellow-600 dark:text-yellow-400">
                        {variant.aliasAsk !== null
                          ? formatMoney(variant.aliasAsk, 'USD')
                          : '—'}
                      </span>
                    </td>

                    {/* Alias Bid */}
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-fg">
                        {variant.aliasBid !== null
                          ? formatMoney(variant.aliasBid, 'USD')
                          : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info */}
      {isExpanded && (
        <div className="px-6 py-3 border-t border-border/50 bg-soft/30">
          <p className="text-xs text-muted">
            Showing {variants.length} size{variants.length !== 1 ? 's' : ''} •
            New condition with good packaging
          </p>
        </div>
      )}
    </div>
  )
}
