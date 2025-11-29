'use client'

/**
 * AliasSizeRunTable - Size run pricing table for Alias platform
 * Matches inventory table styling with fixed height and auto-scroll to user's size
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatMoney } from '@/lib/format/money'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { Badge } from '@/components/ui/badge'

interface AliasSizeRunTableProps {
  variants: Array<{
    size: number
    lowestAskCents: number | null
    highestBidCents: number | null
    lastSoldCents: number | null
  }>
  userSizeUS?: number | null
}

export function AliasSizeRunTable({ variants, userSizeUS }: AliasSizeRunTableProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const tableBodyRef = useRef<HTMLDivElement>(null)
  const userRowRef = useRef<HTMLTableRowElement>(null)

  // Auto-scroll to user's size on mount
  useEffect(() => {
    if (isExpanded && userSizeUS && userRowRef.current && tableBodyRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        if (userRowRef.current && tableBodyRef.current) {
          const rowTop = userRowRef.current.offsetTop
          const rowHeight = userRowRef.current.offsetHeight
          const containerHeight = tableBodyRef.current.offsetHeight

          // Scroll so user's size is roughly centered
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
            Alias Size Run (USD)
          </h3>
          <PlatformBadge platform="alias" size="sm" />
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
                <th className="px-4 py-2.5 label-up text-left">Size (US)</th>
                <th className="px-4 py-2.5 label-up text-right">Lowest Ask</th>
                <th className="px-4 py-2.5 label-up text-right">Highest Bid</th>
                <th className="px-4 py-2.5 label-up text-right">Last Sold</th>
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
                    <td className="px-4 py-3 text-sm text-fg">
                      <div className="flex items-center gap-2">
                        <span className={cn(isUserSize && 'font-semibold')}>
                          {variant.size}
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
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-fg">
                        {variant.lowestAskCents !== null
                          ? formatMoney(variant.lowestAskCents / 100, 'USD')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-fg">
                        {variant.highestBidCents !== null
                          ? formatMoney(variant.highestBidCents / 100, 'USD')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="mono text-sm text-muted">
                        {variant.lastSoldCents !== null
                          ? formatMoney(variant.lastSoldCents / 100, 'USD')
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
            New condition with good packaging •
            Prices in USD
          </p>
        </div>
      )}
    </div>
  )
}
