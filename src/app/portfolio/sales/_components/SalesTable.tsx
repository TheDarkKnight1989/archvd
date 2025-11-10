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
import { useCurrency } from '@/hooks/useCurrency'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { formatSize } from '@/lib/format/size'
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
  const { convert, format } = useCurrency()

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
              {formatSize(size, 'UK')}
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
              <PlainMoneyCell value={total} />
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sold_price', {
        id: 'sold_price',
        header: () => <div className="text-right">Sold £</div>,
        cell: (info) => (
          <div className="text-right">
            <PlainMoneyCell value={info.getValue()} />
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('margin_gbp', {
        id: 'margin_gbp',
        header: () => <div className="text-right">Margin £</div>,
        cell: (info) => (
          <div className="text-right">
            <MoneyCell value={info.getValue()} showArrow />
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('margin_percent', {
        id: 'margin_percent',
        header: () => <div className="text-right">Margin %</div>,
        cell: (info) => (
          <div className="text-right">
            <PercentCell value={info.getValue()} />
          </div>
        ),
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
          const item = info.row.original
          const isStockX = platform?.toLowerCase() === 'stockx' || !!item.stockx_order_id

          return platform ? (
            <div className="flex items-center gap-2">
              {isStockX && (
                <div className="inline-flex items-center justify-center w-4 h-4 rounded bg-[#00B359]/20 text-[#00B359] text-[9px] font-bold border border-[#00B359]/30">
                  Sx
                </div>
              )}
              <div className="text-sm text-[#E8F6EE]">{platform}</div>
            </div>
          ) : (
            <span className="text-[#7FA08F]">—</span>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('commission', {
        id: 'commission',
        header: () => <div className="text-right">Commission £</div>,
        cell: (info) => {
          const commission = info.getValue()
          const item = info.row.original
          const isStockX = item.platform?.toLowerCase() === 'stockx' || !!item.stockx_order_id

          // Only show commission for StockX sales
          if (!isStockX || !commission) {
            return <div className="text-right text-[#7FA08F]">—</div>
          }

          return (
            <div className="text-right">
              <PlainMoneyCell value={commission} />
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('net_payout', {
        id: 'net_payout',
        header: () => <div className="text-right">Net Payout £</div>,
        cell: (info) => {
          const netPayout = info.getValue()
          const item = info.row.original
          const isStockX = item.platform?.toLowerCase() === 'stockx' || !!item.stockx_order_id

          // Only show net payout for StockX sales
          if (!isStockX || !netPayout) {
            return <div className="text-right text-[#7FA08F]">—</div>
          }

          return (
            <div className="text-right">
              <PlainMoneyCell value={netPayout} />
            </div>
          )
        },
        enableSorting: false,
      }),
    ],
    [convert, format]
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

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px] rounded-2xl border border-[#15251B] bg-gradient-to-br from-[#08100C] to-[#0B1510]">
        <div className="text-center px-6 py-12">
          {/* Icon with accent glow */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            <DollarSign className="h-16 w-16 mx-auto text-accent relative" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <h3 className="text-xl font-semibold text-[#E8F6EE] mb-2">
            No sales yet
          </h3>

          {/* Description */}
          <p className="text-sm text-[#7FA08F] mb-8 max-w-sm mx-auto leading-relaxed">
            When you mark items as sold, they'll appear here with complete sale details and margin analysis.
          </p>
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
                          header.column.getCanSort() && 'cursor-pointer select-none flex items-center gap-1 hover:text-[#E8F6EE] transition-colors duration-120 motion-reduce:transition-none',
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
                  "transition-all duration-120 motion-reduce:transition-none hover:bg-[#0B1510]",
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
