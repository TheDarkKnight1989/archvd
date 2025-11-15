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
import { Sparkline, SparklineSkeleton } from './Sparkline'
import { RowActions } from './RowActions'
import { InventoryCard, InventoryCardSkeleton } from './InventoryCard'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { AliasMapIndicator } from '@/components/AliasMapIndicator'
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
  onAddToWatchlist?: (item: EnrichedInventoryItem) => void
  onAddItem?: () => void
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
  onAddToWatchlist,
  onAddItem,
}: InventoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { convert, format } = useCurrency()

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
            <div className="flex items-center gap-3 min-w-[200px]">
              {/* Thumb */}
              <div className="h-12 w-12 rounded-lg bg-soft border border-border flex items-center justify-center shrink-0 text-xs font-medium text-muted">
                {initials}
              </div>

              {/* Title only (no SKU) */}
              <div className={cn('flex-1 min-w-0', item.status === 'sold' && 'opacity-70')}>
                <div className="text-sm font-medium text-fg truncate">{info.getValue()}</div>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('sku', {
        id: 'sku',
        header: 'SKU',
        cell: (info) => (
          <div className="text-sm text-fg mono font-medium">{info.getValue()}</div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('alias_mapping_status', {
        id: 'alias',
        header: '🧩',
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="flex justify-center">
              <AliasMapIndicator
                status={item.alias_mapping_status}
                aliasProductSku={item.alias_product_sku}
                aliasProductId={item.alias_product_id}
                mockMode={true}
                variant="compact"
              />
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('stockx_mapping_status', {
        id: 'stockx',
        header: () => (
          <div className="flex justify-center">
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded money-pos-tint text-[9px] font-bold border border-profit/30"
              title="StockX"
            >
              Sx
            </span>
          </div>
        ),
        cell: (info) => {
          const status = info.getValue()
          const item = info.row.original

          return (
            <div className="flex justify-center group relative">
              {status === 'mapped' && (
                <div className="inline-flex items-center justify-center w-5 h-5 rounded-full money-pos-tint border border-profit/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {status === 'unmapped' && (
                <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-soft text-dim border border-border">
                  <span className="text-xs">—</span>
                </div>
              )}

              {/* Tooltip */}
              {status === 'mapped' && item.stockx_product_sku && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div className="bg-surface border border-border rounded-lg px-2.5 py-1.5 shadow-medium whitespace-nowrap">
                    <div className="text-2xs text-fg">
                      Mapped to StockX
                      <div className="text-dim mono mt-0.5">{item.stockx_product_sku}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('category', {
        id: 'category',
        header: 'Category',
        cell: (info) => {
          const category = info.getValue()
          return category ? (
            <Badge variant="outline" className="text-xs capitalize">
              {category}
            </Badge>
          ) : (
            <span className="text-dim">—</span>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('purchase_date', {
        id: 'purchase_date',
        header: 'Purchase Date',
        cell: (info) => {
          const date = info.getValue()
          return date ? (
            <div className="text-sm text-fg mono">
              {new Date(date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          ) : (
            <span className="text-dim">—</span>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('purchase_price', {
        id: 'buy',
        header: () => <div className="text-right">Buy £</div>,
        cell: (info) => (
          <div className="text-right mono">
            <PlainMoneyCell value={convert(info.getValue(), 'GBP')} />
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('tax', {
        id: 'tax',
        header: () => <div className="text-right">Tax £</div>,
        cell: (info) => (
          <div className="text-right mono">
            <PlainMoneyCell value={convert(info.getValue() || 0, 'GBP')} />
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.accessor('shipping', {
        id: 'shipping',
        header: () => <div className="text-right">Ship £</div>,
        cell: (info) => (
          <div className="text-right mono">
            <PlainMoneyCell value={convert(info.getValue() || 0, 'GBP')} />
          </div>
        ),
        enableSorting: true,
      }),

      columnHelper.display({
        id: 'total',
        header: () => <div className="text-right">Total £</div>,
        cell: (info) => {
          const item = info.row.original
          const buy = item.purchase_price || 0
          const tax = item.tax || 0
          const shipping = item.shipping || 0
          const total = buy + tax + shipping

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={convert(total, 'GBP')} />
            </div>
          )
        },
      }),

      columnHelper.accessor('market_value', {
        id: 'market',
        header: () => <div className="text-right">Market £</div>,
        cell: (info) => {
          const value = info.getValue()
          const source = info.row.original.market_source
          const item = info.row.original

          // StockX provenance
          const isStockX = source === 'stockx'
          const stockxAsOf = item.stockx_price_as_of
          const provenanceText = isStockX && stockxAsOf
            ? `StockX • as of ${new Date(stockxAsOf).toLocaleString()}`
            : source !== '-' ? source : null

          return (
            <div className="text-right group relative mono">
              <PlainMoneyCell value={value ? convert(value, 'GBP') : null} />

              {/* Source badge */}
              {source !== '-' && value && (
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {isStockX && (
                    <div className="inline-flex items-center justify-center w-4 h-4 rounded money-pos-tint text-[9px] font-bold border border-profit/30">
                      Sx
                    </div>
                  )}
                  <div className="text-2xs text-dim mono">{source}</div>
                </div>
              )}

              {/* Provenance tooltip */}
              {provenanceText && (
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
                  <div className="bg-surface border border-border rounded-lg px-2.5 py-1.5 shadow-medium whitespace-nowrap">
                    <div className="text-2xs text-fg">{provenanceText}</div>
                  </div>
                </div>
              )}
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.display({
        id: 'gain_loss',
        header: () => <div className="text-right">% Gain/Loss</div>,
        cell: (info) => {
          const item = info.row.original
          const market = item.market_value
          const buy = item.purchase_price || 0
          const tax = item.tax || 0
          const shipping = item.shipping || 0
          const total = buy + tax + shipping

          const gainLoss = market != null && total > 0 ? ((market - total) / total) * 100 : null

          return (
            <div className="text-right mono">
              <PercentCell value={gainLoss} />
            </div>
          )
        },
      }),

      columnHelper.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          return (
            <Badge variant="outline" className="text-xs capitalize">
              {status}
            </Badge>
          )
        },
        enableSorting: true,
      }),

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
      <div className="flex items-center justify-center min-h-[500px] rounded-2xl border border-border bg-surface shadow-soft">
        <div className="text-center px-6 py-16">
          {/* Icon */}
          <div className="inline-block mb-6">
            <Package className="h-16 w-16 mx-auto text-muted" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <h3 className="text-xl font-semibold text-fg mb-3">
            Your inventory is empty
          </h3>

          {/* Description */}
          <p className="text-sm text-muted mb-8 max-w-sm mx-auto leading-relaxed">
            Start building your portfolio by adding your first item. Track market values, monitor performance, and manage your collection.
          </p>

          {/* CTA Button */}
          {onAddItem && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-fg font-medium rounded-xl hover:bg-accent-600 transition-boutique active:scale-95 motion-reduce:active:scale-100"
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
      {/* Mobile Card View (< 1024px) */}
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

      {/* Desktop Table View (>= 1024px) */}
      <div
        ref={parentRef}
        className="hidden lg:block h-[calc(100vh-280px)] overflow-auto rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {/* Sticky Header */}
          <div className="sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex">
                {headerGroup.headers.map((header, idx) => (
                <div
                  key={header.id}
                  className={cn(
                    'px-4 py-3.5 label-up flex-shrink-0 border-r border-border/20 last:border-r-0',
                    header.column.getCanSort() && 'cursor-pointer select-none hover:text-fg transition-boutique',
                    header.id === 'item' && 'flex-1 min-w-[240px]',
                    header.id === 'sku' && 'w-[140px]',
                    header.id === 'alias' && 'w-[60px]',
                    header.id === 'category' && 'w-[110px]',
                    header.id === 'purchase_date' && 'w-[130px]',
                    header.id === 'buy' && 'w-[100px]',
                    header.id === 'tax' && 'w-[90px]',
                    header.id === 'shipping' && 'w-[90px]',
                    header.id === 'total' && 'w-[110px]',
                    header.id === 'market' && 'w-[110px]',
                    header.id === 'gain_loss' && 'w-[120px]',
                    header.id === 'status' && 'w-[100px]',
                    header.id === 'actions' && 'w-[80px]'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() && (
                      <span className="text-accent">
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
                'absolute left-0 right-0 flex items-center border-b border-border min-h-12 hover:bg-table-hover transition-boutique cursor-pointer',
                virtualRow.index % 2 === 0 ? 'bg-table-zebra' : 'bg-panel'
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
                    'px-4 py-2 flex-shrink-0 border-r border-border/10 last:border-r-0',
                    cell.column.id === 'item' && 'flex-1 min-w-[240px]',
                    cell.column.id === 'sku' && 'w-[140px]',
                    cell.column.id === 'alias' && 'w-[60px]',
                    cell.column.id === 'category' && 'w-[110px]',
                    cell.column.id === 'purchase_date' && 'w-[130px]',
                    cell.column.id === 'buy' && 'w-[100px]',
                    cell.column.id === 'tax' && 'w-[90px]',
                    cell.column.id === 'shipping' && 'w-[90px]',
                    cell.column.id === 'total' && 'w-[110px]',
                    cell.column.id === 'market' && 'w-[110px]',
                    cell.column.id === 'gain_loss' && 'w-[120px]',
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

// Skeleton component
export function InventoryTableSkeleton() {
  return (
    <>
      {/* Mobile Skeleton */}
      <div className="lg:hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <InventoryCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden lg:block rounded-2xl border border-border bg-surface shadow-soft p-5 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <SparklineSkeleton />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  )
}
