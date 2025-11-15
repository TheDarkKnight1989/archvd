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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { MoneyCell, PercentCell, PlainMoneyCell } from '@/lib/format/money'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import { ProvenanceBadge } from '@/components/product/ProvenanceBadge'
import { TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import { RowActions } from './RowActions'
import { InventoryCard, InventoryCardSkeleton } from './InventoryCard'
import type { EnrichedInventoryItem } from '@/hooks/usePortfolioInventory'
import type { Provider } from '@/types/product'

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
  hiddenIncompleteCount?: number
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
  hiddenIncompleteCount = 0,
}: PortfolioTableProps) {
  const { convert, format } = useCurrency()

  // Define columns matching spec: Item | SKU | Category | Purchase Date | Buy £ | Tax £ | Ship £ | Total £ | Market £ | % Gain/Loss | Status | Actions
  const columns = useMemo(
    () => [
      // Item - Standardized product line item with image, brand/model, variant, size chip, and SKU chip
      columnHelper.accessor('full_title', {
        id: 'item',
        header: 'Item',
        cell: (info) => {
          const item = info.row.original

          return (
            <ProductLineItem
              imageUrl={item.image_url || null}
              imageAlt={item.full_title}
              brand={item.brand || ''}
              model={item.model || ''}
              variant={item.colorway ?? undefined}
              sku={item.sku}
              href={`/product/${item.sku}`}
              sizeUk={item.size_uk || item.size}
              sizeSystem="UK"
              category={(item.category?.toLowerCase() as any) || 'other'}
              className="min-w-[280px]"
            />
          )
        },
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
          <div className="text-right mono">
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
          <div className="text-right mono">
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
          <div className="text-right mono">
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
          <div className="text-right mono">
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
          const item = info.row.original
          const source = item.market_source
          const timestamp = item.stockx_price_as_of || item.market_updated_at

          return value !== null && value !== undefined ? (
            <div className="text-right">
              <div className="mono">
                <PlainMoneyCell value={value} />
              </div>
              {source && source !== '-' && timestamp && (
                <div className="flex justify-end mt-1">
                  <ProvenanceBadge
                    provider={source as Provider}
                    timestamp={timestamp}
                    variant="compact"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-right text-dim">—</div>
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
            <div className="text-right mono">
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
      {/* Incomplete Items Banner */}
      {hiddenIncompleteCount > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-warning/30 bg-warning/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-warning text-sm font-medium">
              Hidden {hiddenIncompleteCount} incomplete item{hiddenIncompleteCount !== 1 ? 's' : ''}
            </div>
            <div className="text-dim text-xs">
              (missing product info or market data)
            </div>
          </div>
          <a
            href="/portfolio/maintenance/incomplete"
            className="text-xs text-accent hover:text-accent-600 font-medium underline"
          >
            Review &rarr;
          </a>
        </div>
      )}

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
      <div className="hidden lg:block">
        <TableBase>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'hover:text-fg transition-boutique'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-accent">
                            {header.column.getIsSorted() === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={row.id}
                index={idx}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </TableBase>
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
