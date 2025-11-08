'use client'

import { useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type OnChangeFn,
} from '@tanstack/react-table'
import { gbp2, formatPct, deltaColor } from '@/lib/utils/format'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

const columnHelper = createColumnHelper<SalesItem>()

export interface SalesTableProps {
  items: SalesItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
}

export function SalesTable({
  items,
  loading,
  sorting,
  onSortingChange,
}: SalesTableProps) {
  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'item',
        header: 'Item',
        cell: (info) => {
          const item = info.row.original
          const initials = item.brand?.slice(0, 2).toUpperCase() || 'IT'

          return (
            <div className="flex items-center gap-3 min-w-[220px]">
              {/* Thumb */}
              <div className="h-10 w-10 rounded-lg bg-elev-1 flex items-center justify-center shrink-0 text-xs font-medium text-muted border border-border">
                {initials}
              </div>

              {/* Title stack */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-fg truncate">
                  {item.brand} {item.model}
                </div>
                <div className="text-xs text-muted font-mono">{item.sku}</div>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('size_uk', {
        id: 'size',
        header: 'Size',
        cell: (info) => (
          <div className="text-sm text-fg">
            {info.getValue() || info.row.original.size_alt || '—'}
          </div>
        ),
        enableSorting: false,
      }),

      columnHelper.accessor('purchase_price', {
        id: 'purchase_price',
        header: () => <div className="text-right">Purchase £</div>,
        cell: (info) => {
          const price = info.getValue()
          const tax = info.row.original.tax || 0
          const shipping = info.row.original.shipping || 0
          const total = price + tax + shipping

          return (
            <div className="text-right">
              <div className="text-sm font-mono font-medium text-fg">
                {gbp2.format(total)}
              </div>
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sold_price', {
        id: 'sold_price',
        header: () => <div className="text-right">Sold £</div>,
        cell: (info) => {
          const price = info.getValue()
          return price !== null && price !== undefined ? (
            <div className="text-right text-sm font-mono font-medium text-fg">
              {gbp2.format(price)}
            </div>
          ) : (
            <div className="text-right text-muted">—</div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('margin_gbp', {
        id: 'margin_gbp',
        header: () => <div className="text-right">Margin £</div>,
        cell: (info) => {
          const margin = info.getValue()
          return margin !== null && margin !== undefined ? (
            <div className={cn(
              "text-right text-sm font-mono font-semibold",
              margin >= 0 ? "text-success" : "text-danger"
            )}>
              {margin >= 0 ? '+' : ''}{gbp2.format(margin)}
            </div>
          ) : (
            <div className="text-right text-muted">—</div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('margin_percent', {
        id: 'margin_percent',
        header: () => <div className="text-right">Margin %</div>,
        cell: (info) => {
          const pct = info.getValue()
          return pct !== null && pct !== undefined ? (
            <div className="text-right flex items-center justify-end gap-1">
              {pct >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
              )}
              <span className={cn(
                "text-sm font-mono font-semibold",
                pct >= 0 ? "text-success" : "text-danger"
              )}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
              </span>
            </div>
          ) : (
            <div className="text-right text-muted">—</div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sold_date', {
        id: 'sold_date',
        header: 'Sold Date',
        cell: (info) => {
          const date = info.getValue()
          return date ? (
            <div className="text-sm text-fg">
              {new Date(date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          ) : (
            <span className="text-muted">—</span>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sold_platform', {
        id: 'platform',
        header: 'Platform',
        cell: (info) => {
          const platform = info.getValue()
          return platform ? (
            <div className="text-sm text-fg">{platform}</div>
          ) : (
            <span className="text-muted">—</span>
          )
        },
        enableSorting: false,
      }),
    ],
    []
  )

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
    },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  })

  if (loading) {
    return (
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-elev-2 border-b border-border">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs text-dim uppercase tracking-wider">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-elev-1">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-elev-2 border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs text-dim uppercase tracking-wider font-semibold"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          header.column.getCanSort() && 'cursor-pointer select-none flex items-center gap-1 hover:text-fg transition-colors',
                          !header.column.getCanSort() && 'flex items-center'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-elev-1 divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-elev-2 transition-colors duration-120"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
