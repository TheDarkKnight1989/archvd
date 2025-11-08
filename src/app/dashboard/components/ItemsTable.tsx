'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { gbp2 } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface TableRow {
  id: string
  thumb?: string
  title: string
  sku: string
  size: string
  status: 'in_stock' | 'sold' | 'reserved'
  buy: number
  market?: number | null
  marketSource?: string | null
  marketUpdatedAt?: string | null
  pl?: number | null
  plPct?: number | null
}

interface ItemsTableProps {
  rows: TableRow[]
  loading?: boolean
  error?: string
}

export function ItemsTable({ rows, loading, error }: ItemsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = rows.length > 500

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    enabled: shouldVirtualize,
  })

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-danger font-medium">Error loading items</p>
          <p className="text-sm text-muted mt-1">{error}</p>
        </div>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <p className="text-dim font-mono">No items</p>
          <p className="text-sm text-muted mt-1">Add your first pair to get started</p>
        </div>
      </Card>
    )
  }

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'cached'
    const now = new Date()
    const date = new Date(dateString)
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const visibleRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : rows.map((_, index) => ({ index, size: 48, start: index * 48 }))

  return (
    <Card className="overflow-hidden">
      <div
        ref={parentRef}
        className="overflow-x-auto"
        style={{ maxHeight: shouldVirtualize ? '600px' : 'auto' }}
      >
        <table className="min-w-full">
          <thead className="sticky top-0 bg-bg text-muted text-xs border-b border-border border-t border-t-accent-400/25">
            <tr>
              <th className="px-3 md:px-4 py-3 text-left font-medium min-w-[220px]">Item</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium w-[110px]">SKU</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium w-[72px]">Size</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium w-[100px]">Status</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium w-[110px]">Buy</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium w-[110px]">Market</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium w-[110px]">P/L</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium w-[110px]">P/L %</th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-border"
            style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' } : undefined}
          >
            {visibleRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <tr
                  key={row.id}
                  className="hover:bg-surface/70 transition-colors"
                  style={
                    shouldVirtualize
                      ? {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }
                      : undefined
                  }
                >
                  <td className="px-3 md:px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.thumb && (
                        <img
                          src={row.thumb}
                          alt={row.title}
                          className="h-9 w-9 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <div className="text-sm text-fg">{row.title}</div>
                        <div className="text-[11px] text-dim font-mono">{row.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-xs font-mono text-dim">{row.sku}</td>
                  <td className="px-3 md:px-4 py-3 text-xs font-mono text-fg">{row.size}</td>
                  <td className="px-3 md:px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
                        row.status === 'in_stock' && 'bg-accent-200 text-fg',
                        row.status === 'sold' && 'bg-success/20 text-success',
                        row.status === 'reserved' && 'bg-warning/20 text-warning'
                      )}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right num text-sm text-fg">
                    {gbp2.format(row.buy)}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {row.market ? (
                      <div>
                        <div className="num text-sm text-fg">{gbp2.format(row.market)}</div>
                        {row.marketSource && (
                          <div className="text-[10px] text-dim font-mono mt-0.5">
                            {row.marketSource} • {formatRelativeTime(row.marketUpdatedAt || undefined)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {row.pl !== undefined && row.pl !== null ? (
                      <span
                        className={cn(
                          'num text-sm flex items-center justify-end gap-1',
                          row.pl >= 0 ? 'text-success' : 'text-danger'
                        )}
                      >
                        {row.pl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {gbp2.format(row.pl)}
                      </span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {row.plPct !== undefined && row.plPct !== null ? (
                      <span
                        className={cn(
                          'num text-sm',
                          row.plPct >= 0 ? 'text-success' : 'text-danger'
                        )}
                      >
                        {row.plPct >= 0 ? '+' : ''}{row.plPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
