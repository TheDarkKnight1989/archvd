'use client'

import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Package } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Sparkline, SparklineSkeleton } from './Sparkline'
import { RowActions } from './RowActions'
import type { EnrichedInventoryItem } from '@/hooks/usePortfolioInventory'

const columnHelper = createColumnHelper<EnrichedInventoryItem>()

export interface InventoryTableProps {
  items: EnrichedInventoryItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  columnVisibility?: Record<string, boolean>
  onRowClick?: (item: EnrichedInventoryItem) => void
  onEdit?: (item: EnrichedInventoryItem) => void
  onToggleSold?: (item: EnrichedInventoryItem) => void
  onAddExpense?: (item: EnrichedInventoryItem) => void
}

export function InventoryTable({
  items,
  loading,
  sorting,
  onSortingChange,
  columnVisibility,
  onRowClick,
  onEdit,
  onToggleSold,
  onAddExpense,
}: InventoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor('full_title', {
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
              <div className={cn('flex-1 min-w-0', item.status === 'sold' && 'opacity-80')}>
                <div className="text-sm font-medium text-[#E8F6EE] truncate">{info.getValue()}</div>
                <div className="text-xs text-[#7FA08F] font-mono">{item.sku}</div>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('purchase_date', {
        id: 'purchase_date',
        header: 'Purchase Date',
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

      columnHelper.accessor('market_value', {
        id: 'market',
        header: () => <div className="text-right">Market £</div>,
        cell: (info) => {
          const value = info.getValue()
          const source = info.row.original.market_source

          return value !== null && value !== undefined ? (
            <div className="text-right">
              <div className="text-sm font-mono font-medium text-[#E8F6EE]">{gbp2.format(value)}</div>
              {source !== '-' && (
                <div className="text-[10px] text-[#7FA08F] font-mono mt-0.5">{source}</div>
              )}
            </div>
          ) : (
            <div className="text-right text-[#7FA08F]">—</div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sparkline_data', {
        id: 'chart',
        header: () => <div className="text-center hidden lg:block">Price Chart</div>,
        cell: (info) => (
          <div className="hidden lg:flex justify-center">
            <Sparkline data={info.getValue()} width={70} height={28} />
          </div>
        ),
        enableSorting: false,
      }),

      columnHelper.display({
        id: 'qty',
        header: () => <div className="text-center">Qty</div>,
        cell: () => <div className="text-center text-sm text-[#7FA08F]">1</div>,
      }),

      columnHelper.display({
        id: 'total',
        header: () => <div className="text-right">Total £</div>,
        cell: (info) => {
          const market = info.row.original.market_value
          const qty = 1
          const total = market ? market * qty : null

          return total !== null ? (
            <div className="text-right text-sm font-mono font-medium text-[#E8F6EE]">
              {gbp2.format(total)}
            </div>
          ) : (
            <div className="text-right text-[#7FA08F]">—</div>
          )
        },
      }),

      columnHelper.accessor('invested', {
        id: 'invested',
        header: () => <div className="text-right">Invested £</div>,
        cell: (info) => (
          <div className="text-right text-sm font-mono text-[#E8F6EE]">
            {gbp2.format(info.getValue())}
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('profit', {
        id: 'profit',
        header: () => <div className="text-right">Profit/Loss £</div>,
        cell: (info) => {
          const profit = info.getValue()

          if (profit === null || profit === undefined) {
            return <div className="text-right text-[#7FA08F]">—</div>
          }

          const isPositive = profit > 0
          const isNegative = profit < 0

          return (
            <div className={cn('text-right text-sm font-mono flex items-center justify-end gap-1', deltaColor(profit))}>
              {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
              {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
              <span>{gbp2.format(Math.abs(profit))}</span>
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('performance_pct', {
        id: 'performance',
        header: () => <div className="text-right hidden xl:block">Performance %</div>,
        cell: (info) => {
          const pct = info.getValue()

          if (pct === null || pct === undefined) {
            return <div className="text-right text-[#7FA08F] hidden xl:block">—</div>
          }

          return (
            <div className={cn('text-right text-sm font-mono hidden xl:block', deltaColor(pct))}>
              {formatPct(pct)}
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <RowActions
            status={info.row.original.status || 'in_stock'}
            onEdit={() => onEdit?.(info.row.original)}
            onToggleSold={() => onToggleSold?.(info.row.original)}
            onAddExpense={() => onAddExpense?.(info.row.original)}
          />
        ),
      }),
    ],
    [onEdit, onToggleSold, onAddExpense]
  )

  // Setup table
  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  })

  const { rows } = table.getRowModel()

  // Setup virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Row height
    overscan: 10,
  })

  if (loading) {
    return <InventoryTableSkeleton />
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="h-12 w-12 mx-auto text-[#7FA08F] opacity-40 mb-4" />
        <p className="text-[#7FA08F] font-medium mb-1">No items in your inventory</p>
        <p className="text-sm text-[#7FA08F]/70">Add your first item to get started</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-280px)] overflow-auto rounded-2xl border border-[#15251B] bg-[#08100C]"
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#0B1510] border-b border-t border-t-[#0F8D65]/25 border-b-[#15251B]">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className={cn(
                    'px-4 py-3 text-xs font-medium text-[#B7D0C2] flex-shrink-0',
                    header.column.getCanSort() && 'cursor-pointer select-none hover:text-[#E8F6EE]',
                    header.id === 'item' && 'flex-1 min-w-[280px]',
                    header.id === 'purchase_date' && 'w-[140px]',
                    header.id === 'market' && 'w-[120px]',
                    header.id === 'chart' && 'w-[100px]',
                    header.id === 'qty' && 'w-[70px]',
                    header.id === 'total' && 'w-[120px]',
                    header.id === 'invested' && 'w-[120px]',
                    header.id === 'profit' && 'w-[140px]',
                    header.id === 'performance' && 'w-[130px]',
                    header.id === 'actions' && 'w-[80px]'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (
                      <span className="text-[#00FF94]">
                        {header.column.getIsSorted() === 'desc' ? '↓' : '↑'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Virtualized Rows */}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]

          return (
            <div
              key={row.id}
              className={cn(
                'absolute left-0 right-0 flex items-center border-b border-[#15251B]/40 transition-all duration-120',
                'hover:bg-[#0B1510] cursor-pointer',
                virtualRow.index % 2 === 0 && 'bg-[#08100C]/30'
              )}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <div
                  key={cell.id}
                  className={cn(
                    'px-4 py-2 flex-shrink-0',
                    cell.column.id === 'item' && 'flex-1 min-w-[280px]',
                    cell.column.id === 'purchase_date' && 'w-[140px]',
                    cell.column.id === 'market' && 'w-[120px]',
                    cell.column.id === 'chart' && 'w-[100px]',
                    cell.column.id === 'qty' && 'w-[70px]',
                    cell.column.id === 'total' && 'w-[120px]',
                    cell.column.id === 'invested' && 'w-[120px]',
                    cell.column.id === 'profit' && 'w-[140px]',
                    cell.column.id === 'performance' && 'w-[130px]',
                    cell.column.id === 'actions' && 'w-[80px]'
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Skeleton component
export function InventoryTableSkeleton() {
  return (
    <div className="rounded-2xl border border-[#15251B] bg-[#08100C] p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <SparklineSkeleton />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
