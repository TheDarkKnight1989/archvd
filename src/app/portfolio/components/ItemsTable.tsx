'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { formatSize } from '@/lib/format/size'

interface TableRow {
  id: string
  thumb?: string
  title: string
  sku: string
  size: string
  status: 'active' | 'listed' | 'worn' | 'sold'
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
  const { convert, format } = useCurrency()
  const shouldVirtualize = rows.length > 500

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    enabled: shouldVirtualize,
  })

  if (loading) {
    return (
      <div className="table-wrap">
        <div className="p-5 md:p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="panel p-6">
        <div className="text-center py-12">
          <p className="text-danger font-medium">Error loading items</p>
          <p className="text-sm text-muted mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="panel p-6">
        <div className="text-center py-16">
          <p className="text-sm font-medium text-fg">No items</p>
          <p className="text-xs text-muted mt-2">Add your first item to get started</p>
        </div>
      </div>
    )
  }

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'cached'
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffSecs < 60) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const visibleRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : rows.map((_, index) => ({ index, size: 48, start: index * 48 }))

  return (
    <div className="table-wrap">
      <div
        ref={parentRef}
        className="overflow-x-auto"
        style={{ maxHeight: shouldVirtualize ? '600px' : 'auto' }}
      >
        <table className="min-w-full">
          <thead className="sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm">
            <tr>
              <th className="px-4 md:px-5 py-3.5 text-left label-up min-w-[220px]">Item</th>
              <th className="px-4 md:px-5 py-3.5 text-left label-up w-[72px]">Size</th>
              <th className="px-4 md:px-5 py-3.5 text-left label-up w-[100px]">Status</th>
              <th className="px-4 md:px-5 py-3.5 text-right label-up w-[110px]">Purchase</th>
              <th className="px-4 md:px-5 py-3.5 text-right label-up w-[110px]">Market</th>
              <th className="px-4 md:px-5 py-3.5 text-right label-up w-[120px]">Unrealized</th>
              <th className="px-4 md:px-5 py-3.5 text-right label-up w-[100px]">Gain %</th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-border"
            style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' } : undefined}
          >
            {visibleRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              const unrealizedGain = row.market ? row.market - row.buy : null
              const gainPct = row.market && row.buy ? ((row.market - row.buy) / row.buy) * 100 : null

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "min-h-12 hover:bg-table-hover transition-boutique",
                    virtualRow.index % 2 === 0 ? "bg-table-zebra" : "bg-panel"
                  )}
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
                  <td className="px-4 md:px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {row.thumb ? (
                        <img
                          src={row.thumb}
                          alt={row.title}
                          className="h-12 w-12 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-soft border border-border flex items-center justify-center text-xs font-medium text-muted">
                          {row.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-fg font-medium">{row.title}</div>
                        <div className="text-xs text-muted num">{row.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-sm text-fg mono">
                    {formatSize(row.size, 'UK')}
                  </td>
                  <td className="px-4 md:px-5 py-3.5">
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-1 text-xs font-medium rounded-lg',
                        row.status === 'active' && 'bg-soft text-fg',
                        row.status === 'listed' && 'bg-accent-200 text-accent-600',
                        row.status === 'worn' && 'bg-warning/15 text-warning',
                        row.status === 'sold' && 'money-pos-tint'
                      )}
                    >
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-right text-sm text-fg mono">
                    {format(convert(row.buy, 'GBP'))}
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-right">
                    {row.market ? (
                      <div>
                        <div className="text-sm text-fg mono">{format(convert(row.market, 'GBP'))}</div>
                        {row.marketSource && (
                          <div className="text-2xs text-dim mono mt-0.5">
                            {row.marketSource} • {formatRelativeTime(row.marketUpdatedAt || undefined)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-right">
                    {unrealizedGain !== null ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {unrealizedGain >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 money-pos" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 money-neg" />
                        )}
                        <span
                          className={cn(
                            'text-sm mono font-semibold',
                            unrealizedGain >= 0 ? 'money-pos' : 'money-neg'
                          )}
                        >
                          {unrealizedGain >= 0 ? '+' : ''}{format(convert(unrealizedGain, 'GBP'))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 md:px-5 py-3.5 text-right">
                    {gainPct !== null ? (
                      <span
                        className={cn(
                          'text-sm mono font-semibold',
                          gainPct >= 0 ? 'money-pos' : 'money-neg'
                        )}
                      >
                        {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
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
    </div>
  )
}
