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
              <div className="h-10 w-10 rounded-lg bg-[#0E1A15] flex items-center justify-center shrink-0 text-xs font-medium text-[#7FA08F]">
                {initials}
              </div>

              {/* Title stack */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#E8F6EE] truncate">
                  {item.brand} {item.model}
                </div>
                <div className="text-xs text-[#7FA08F] font-mono">{item.sku}</div>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('size_uk', {
        id: 'size',
        header: 'Size',
        cell: (info) => {
          const size = info.getValue()
          return (
            <div className="text-sm text-[#E8F6EE]">
              {size || <span className="text-[#7FA08F]">—</span>}
            </div>
          )
        },
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
              <div className="text-sm font-mono font-medium text-[#E8F6EE]">
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
            <div className="text-right text-sm font-mono font-medium text-[#E8F6EE]">
              {gbp2.format(price)}
            </div>
          ) : (
            <div className="text-right text-[#7FA08F]">—</div>
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
            <div className="text-right text-[#7FA08F]">—</div>
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
            <div className="text-right text-[#7FA08F]">—</div>
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
            <div className="text-sm text-[#E8F6EE]">
              {new Date(date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          ) : (
            <span className="text-[#7FA08F]">—</span>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('platform', {
        id: 'platform',
        header: 'Platform',
        cell: (info) => {
          const platform = info.getValue()
          return platform ? (
            <div className="text-sm text-[#E8F6EE]">{platform}</div>
          ) : (
            <span className="text-[#7FA08F]">—</span>
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
      <div className="rounded-2xl border border-[#15251B] bg-[#08100C] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B1510] border-b border-t border-t-[#0F8D65]/25 border-b-[#15251B]">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs text-[#B7D0C2] uppercase tracking-wider">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-[#08100C]">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-[#15251B]/40">
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
    <div className="rounded-2xl border border-[#15251B] bg-[#08100C] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[#0B1510] border-b border-t border-t-[#0F8D65]/25 border-b-[#15251B]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs text-[#B7D0C2] uppercase tracking-wider font-medium"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          header.column.getCanSort() && 'cursor-pointer select-none flex items-center gap-1 hover:text-[#E8F6EE] transition-colors',
                          !header.column.getCanSort() && 'flex items-center'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() && (
                          <span className="text-[#00FF94]">
                            {header.column.getIsSorted() === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#15251B]/40">
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  "transition-all duration-120 hover:bg-[#0B1510]",
                  idx % 2 === 0 && "bg-[#08100C]/30"
                )}
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
