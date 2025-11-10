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
      <div className="rounded-2xl border border-[#15251B] bg-[#08100C] overflow-hidden">
        <div className="p-4">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#15251B] bg-[#08100C] p-6">
        <div className="text-center py-8">
          <p className="text-danger font-medium">Error loading items</p>
          <p className="text-sm text-[#7FA08F] mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#15251B] bg-[#08100C] p-6">
        <div className="text-center py-12">
          <p className="text-[#7FA08F] font-mono">No items</p>
          <p className="text-sm text-[#7FA08F] mt-1">Add your first pair to get started</p>
        </div>
      </div>
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
    <div className="rounded-2xl border border-[#15251B] bg-[#08100C] overflow-hidden">
      <div
        ref={parentRef}
        className="overflow-x-auto"
        style={{ maxHeight: shouldVirtualize ? '600px' : 'auto' }}
      >
        <table className="min-w-full">
          <thead className="sticky top-0 bg-[#0B1510] border-b border-t border-t-[#0F8D65]/25 border-b-[#15251B] z-10">
            <tr>
              <th className="px-3 md:px-4 py-3 text-left text-xs text-[#B7D0C2] uppercase tracking-wider font-medium min-w-[220px]">Item</th>
              <th className="px-3 md:px-4 py-3 text-left text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[72px]">Size</th>
              <th className="px-3 md:px-4 py-3 text-left text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[100px]">Status</th>
              <th className="px-3 md:px-4 py-3 text-right text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[110px]">Purchase £</th>
              <th className="px-3 md:px-4 py-3 text-right text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[110px]">Market £</th>
              <th className="px-3 md:px-4 py-3 text-right text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[120px]">Unrealized</th>
              <th className="px-3 md:px-4 py-3 text-right text-xs text-[#B7D0C2] uppercase tracking-wider font-medium w-[100px]">Gain %</th>
            </tr>
          </thead>
          <tbody
            className="divide-y divide-[#15251B]/40"
            style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' } : undefined}
          >
            {visibleRows.map((virtualRow) => {
              const row = rows[virtualRow.index]
              const unrealizedGain = row.market ? row.market - row.buy : null
              const gainPct = row.market && row.buy ? ((row.market - row.buy) / row.buy) * 100 : null

              return (
                <tr
                  key={row.id}
                  className="hover:bg-[#0B1510]/60 transition-colors"
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
                      {row.thumb ? (
                        <img
                          src={row.thumb}
                          alt={row.title}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#0E1A15] flex items-center justify-center text-xs font-medium text-[#7FA08F]">
                          {row.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-[#E8F6EE] font-medium">{row.title}</div>
                        <div className="text-[11px] text-[#7FA08F] font-mono">{row.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-sm text-[#E8F6EE]">
                    {formatSize(row.size, 'UK')}
                  </td>
                  <td className="px-3 md:px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
                        row.status === 'active' && 'bg-accent/20 text-accent',
                        row.status === 'listed' && 'bg-blue-500/20 text-blue-400',
                        row.status === 'worn' && 'bg-warning/20 text-warning',
                        row.status === 'sold' && 'bg-success/20 text-success'
                      )}
                    >
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right text-sm text-[#E8F6EE] font-mono">
                    {format(convert(row.buy, 'GBP'))}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {row.market ? (
                      <div>
                        <div className="text-sm text-[#E8F6EE] font-mono">{format(convert(row.market, 'GBP'))}</div>
                        {row.marketSource && (
                          <div className="text-[10px] text-[#7FA08F] font-mono mt-0.5">
                            {row.marketSource} • {formatRelativeTime(row.marketUpdatedAt || undefined)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#7FA08F]">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {unrealizedGain !== null ? (
                      <div className="flex items-center justify-end gap-1">
                        {unrealizedGain >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-danger" />
                        )}
                        <span
                          className={cn(
                            'text-sm font-mono font-semibold',
                            unrealizedGain >= 0 ? 'text-success' : 'text-danger'
                          )}
                        >
                          {unrealizedGain >= 0 ? '+' : ''}{format(convert(unrealizedGain, 'GBP'))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#7FA08F]">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 text-right">
                    {gainPct !== null ? (
                      <span
                        className={cn(
                          'text-sm font-mono font-semibold',
                          gainPct >= 0 ? 'text-success' : 'text-danger'
                        )}
                      >
                        {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[#7FA08F]">—</span>
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
