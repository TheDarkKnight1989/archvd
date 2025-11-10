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
import { useCurrency } from '@/hooks/useCurrency'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MoneyCell, PercentCell, PlainMoneyCell } from '@/lib/format/money'
import { formatSize } from '@/lib/format/size'
import { RowActions } from './RowActions'
import { InventoryCard, InventoryCardSkeleton } from './InventoryCard'
import type { EnrichedInventoryItem } from '@/hooks/usePortfolioInventory'

const columnHelper = createColumnHelper<EnrichedInventoryItem>()

export interface PortfolioTableProps {
  items: EnrichedInventoryItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  columnVisibility?: Record<string, boolean>
  onRowClick?: (item: EnrichedInventoryItem) => void
  onEdit?: (item: EnrichedInventoryItem) => void
  onToggleSold?: (item: EnrichedInventoryItem) => void
  onAddExpense?: (item: EnrichedInventoryItem) => void
  onAddToWatchlist?: (item: EnrichedInventoryItem) => void
  onAddItem?: () => void
}

/**
 * Portfolio Table - Active items view
 *
 * Columns: Item | SKU | Category | Purchase Date | Buy £ | Tax £ | Ship £ | Total £ | Market £ | % Gain/Loss | Status | Actions
 */
export function PortfolioTable({
  items,
  loading,
  sorting,
  onSortingChange,
  columnVisibility,
  onRowClick,
  onEdit,
  onToggleSold,
  onAddExpense,
  onAddToWatchlist,
  onAddItem,
}: PortfolioTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { convert, format } = useCurrency()

  // Define columns matching spec: Item | SKU | Category | Purchase Date | Buy £ | Tax £ | Ship £ | Total £ | Market £ | % Gain/Loss | Status | Actions
  const columns = useMemo(
    () => [
      // Item
      columnHelper.accessor('full_title', {
        id: 'item',
        header: 'Item',
        cell: (info) => {
          const item = info.row.original
          const initials = item.brand?.slice(0, 2).toUpperCase() || 'IT'

          return (
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="h-10 w-10 rounded-lg bg-[#0E1A15] flex items-center justify-center shrink-0 text-xs font-medium text-[#7FA08F]">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#E8F6EE] truncate">{info.getValue()}</div>
                <div className="text-xs text-[#7FA08F]">{formatSize(item.size_uk || item.size, 'UK')}</div>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      // SKU
      columnHelper.accessor('sku', {
        id: 'sku',
        header: 'SKU',
        cell: (info) => (
          <div className="text-sm font-mono text-[#E8F6EE]">{info.getValue()}</div>
        ),
        enableSorting: false,
      }),

      // Category
      columnHelper.accessor('category', {
        id: 'category',
        header: 'Category',
        cell: (info) => {
          const category = info.getValue()
          return category ? (
            <Badge variant="outline" className="text-xs">
              {category}
            </Badge>
          ) : (
            <span className="text-[#7FA08F]">—</span>
          )
        },
        enableSorting: false,
      }),

      // Purchase Date
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

      // Buy £
      columnHelper.accessor('purchase_price', {
        id: 'buy',
        header: () => <div className="text-right">Buy £</div>,
        cell: (info) => (
          <div className="text-right">
            <PlainMoneyCell value={info.getValue()} />
          </div>
        ),
        enableSorting: true,
      }),

      // Tax £
      columnHelper.accessor('tax', {
        id: 'tax',
        header: () => <div className="text-right">Tax £</div>,
        cell: (info) => (
          <div className="text-right">
            <PlainMoneyCell value={info.getValue()} />
          </div>
        ),
        enableSorting: false,
      }),

      // Ship £
      columnHelper.accessor('shipping', {
        id: 'shipping',
        header: () => <div className="text-right">Ship £</div>,
        cell: (info) => (
          <div className="text-right">
            <PlainMoneyCell value={info.getValue()} />
          </div>
        ),
        enableSorting: false,
      }),

      // Total £ (Buy + Tax + Ship)
      columnHelper.accessor('invested', {
        id: 'total',
        header: () => <div className="text-right">Total £</div>,
        cell: (info) => (
          <div className="text-right">
            <PlainMoneyCell value={info.getValue()} />
          </div>
        ),
        enableSorting: true,
      }),

      // Market £
      columnHelper.accessor('market_value', {
        id: 'market',
        header: () => <div className="text-right">Market £</div>,
        cell: (info) => {
          const value = info.getValue()
          const source = info.row.original.market_source

          return value !== null && value !== undefined ? (
            <div className="text-right">
              <PlainMoneyCell value={value} />
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

      // % Gain/Loss = (Market - Total) / Total * 100
      columnHelper.accessor('performance_pct', {
        id: 'gain_loss_pct',
        header: () => <div className="text-right">% Gain/Loss</div>,
        cell: (info) => {
          const value = info.getValue()
          return (
            <div className="text-right">
              <PercentCell value={value != null ? value * 100 : null} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // Status
      columnHelper.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          return (
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                status === 'active' && 'bg-accent/20 text-accent border-accent/40',
                status === 'listed' && 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                status === 'worn' && 'bg-warning/20 text-warning border-warning/40'
              )}
            >
              {status?.charAt(0).toUpperCase()}{status?.slice(1)}
            </Badge>
          )
        },
        enableSorting: false,
      }),

      // Actions
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <RowActions
            status={info.row.original.status || 'active'}
            onEdit={() => onEdit?.(info.row.original)}
            onToggleSold={() => onToggleSold?.(info.row.original)}
            onAddExpense={() => onAddExpense?.(info.row.original)}
            onAddToWatchlist={() => onAddToWatchlist?.(info.row.original)}
          />
        ),
      }),
    ],
    [onEdit, onToggleSold, onAddExpense, onAddToWatchlist, convert, format]
  )

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

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  })

  if (loading) {
    return <PortfolioTableSkeleton />
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px] rounded-2xl border border-[#15251B] bg-gradient-to-br from-[#08100C] to-[#0B1510]">
        <div className="text-center px-6 py-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            <Package className="h-16 w-16 mx-auto text-accent relative" strokeWidth={1.5} />
          </div>

          <h3 className="text-xl font-semibold text-[#E8F6EE] mb-2">
            Your portfolio is empty
          </h3>

          <p className="text-sm text-[#7FA08F] mb-8 max-w-sm mx-auto leading-relaxed">
            Start building your portfolio by adding your first item. Track market values, monitor performance, and manage your collection.
          </p>

          {onAddItem && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent-600 transition-all duration-120 hover:shadow-[0_0_24px_rgba(0,255,148,0.5)] active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Add Your First Item
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {rows.map((row) => (
          <InventoryCard
            key={row.id}
            item={row.original}
            onClick={() => onRowClick?.(row.original)}
            onEdit={() => onEdit?.(row.original)}
            onToggleSold={() => onToggleSold?.(row.original)}
            onAddExpense={() => onAddExpense?.(row.original)}
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div
        ref={parentRef}
        className="hidden lg:block h-[calc(100vh-280px)] overflow-auto rounded-2xl border border-[#15251B] bg-[#08100C]"
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
                      'px-4 py-3 text-xs font-medium text-[#B7D0C2] uppercase tracking-wider flex-shrink-0',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-[#E8F6EE] transition-colors duration-120',
                      header.id === 'item' && 'flex-1 min-w-[220px]',
                      header.id === 'sku' && 'w-[120px]',
                      header.id === 'category' && 'w-[100px]',
                      header.id === 'purchase_date' && 'w-[130px]',
                      header.id === 'buy' && 'w-[100px]',
                      header.id === 'tax' && 'w-[90px]',
                      header.id === 'shipping' && 'w-[90px]',
                      header.id === 'total' && 'w-[110px]',
                      header.id === 'market' && 'w-[120px]',
                      header.id === 'gain_loss_pct' && 'w-[120px]',
                      header.id === 'status' && 'w-[100px]',
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
                      cell.column.id === 'item' && 'flex-1 min-w-[220px]',
                      cell.column.id === 'sku' && 'w-[120px]',
                      cell.column.id === 'category' && 'w-[100px]',
                      cell.column.id === 'purchase_date' && 'w-[130px]',
                      cell.column.id === 'buy' && 'w-[100px]',
                      cell.column.id === 'tax' && 'w-[90px]',
                      cell.column.id === 'shipping' && 'w-[90px]',
                      cell.column.id === 'total' && 'w-[110px]',
                      cell.column.id === 'market' && 'w-[120px]',
                      cell.column.id === 'gain_loss_pct' && 'w-[120px]',
                      cell.column.id === 'status' && 'w-[100px]',
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
    </>
  )
}

export function PortfolioTableSkeleton() {
  return (
    <>
      <div className="lg:hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <InventoryCardSkeleton key={i} />
        ))}
      </div>

      <div className="hidden lg:block rounded-2xl border border-[#15251B] bg-[#08100C] p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </>
  )
}

// Export alias for backward compatibility
export { PortfolioTable as InventoryTable, PortfolioTableSkeleton as InventoryTableSkeleton }
