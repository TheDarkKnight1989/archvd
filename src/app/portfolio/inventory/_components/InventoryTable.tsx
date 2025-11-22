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
import { ListingStatusBadge } from '@/components/stockx/ListingStatusBadge'
import { MarketplaceListings, type MarketplaceListing } from '@/components/inventory/MarketplaceListings'
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
  // StockX listing actions
  onListOnStockX?: (item: EnrichedInventoryItem) => void
  onRepriceListing?: (item: EnrichedInventoryItem) => void
  onDeactivateListing?: (item: EnrichedInventoryItem) => void
  onReactivateListing?: (item: EnrichedInventoryItem) => void
  onDeleteListing?: (item: EnrichedInventoryItem) => void
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
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
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

      columnHelper.display({
        id: 'marketplaces',
        header: () => (
          <div className="text-center">
            <span className="label-up">Marketplaces</span>
          </div>
        ),
        cell: (info) => {
          const item = info.row.original
          const listings: MarketplaceListing[] = []

          // StockX listing
          if (item.stockx_mapping_status === 'mapped') {
            const listingStatus = item.stockx_listing_status

            let status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'NONE' = 'NONE'
            if (listingStatus === 'ACTIVE') {
              status = 'ACTIVE'
            } else if (listingStatus === 'PENDING') {
              status = 'PENDING'
            } else if (listingStatus === 'INACTIVE') {
              status = 'INACTIVE'
            }

            listings.push({
              marketplace: 'stockx',
              status,
              askPrice: item.stockx_ask_price ? parseFloat(item.stockx_ask_price) : undefined,
              currency: '£',
              expiresAt: item.stockx_listing_expires_at,
            })
          }

          // Future marketplaces can be added here:
          // if (item.goat_listing_id) { listings.push({ marketplace: 'goat', ... }) }
          // if (item.ebay_listing_id) { listings.push({ marketplace: 'ebay', ... }) }

          return (
            <div className="flex justify-center">
              <MarketplaceListings listings={listings} compact />
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
        header: () => <div className="text-right">Market</div>,
        cell: (info) => {
          const item = info.row.original
          const source = item.market_source
          const isStockX = source === 'stockx'

          // Get bid/ask from StockX
          const ask = item.stockx_lowest_ask
          const bid = item.stockx_highest_bid
          const asOf = item.stockx_price_as_of

          // No market data
          if (!ask && !bid) {
            return (
              <div className="text-right">
                <span className="text-xs text-dim italic" title="Market price not yet available">
                  No live price yet
                </span>
              </div>
            )
          }

          const spread = ask && bid ? ask - bid : null
          const spreadPct = ask && bid ? ((spread! / bid) * 100).toFixed(1) : null

          return (
            <div className="text-right group relative">
              {/* Bid/Ask Display */}
              <div className="space-y-0.5">
                {ask && (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-2xs text-dim uppercase tracking-wider">Ask</span>
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 mono tabular-nums">
                      £{ask.toLocaleString()}
                    </span>
                  </div>
                )}
                {bid && (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-2xs text-dim uppercase tracking-wider">Bid</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400 mono tabular-nums">
                      £{bid.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Spread indicator */}
              {spread && spreadPct && (
                <div className="mt-1 text-2xs text-dim mono">
                  Spread: £{spread.toFixed(0)} ({spreadPct}%)
                </div>
              )}

              {/* Source badge */}
              {isStockX && (
                <div className="flex items-center justify-end gap-1 mt-1">
                  <div className="inline-flex items-center justify-center w-4 h-4 rounded money-pos-tint text-[9px] font-bold border border-profit/30">
                    Sx
                  </div>
                  <div className="text-2xs text-dim mono">{source}</div>
                </div>
              )}

              {/* Detailed tooltip on hover */}
              {asOf && (
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
                  <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-medium whitespace-nowrap min-w-[200px]">
                    <div className="text-xs font-semibold text-fg mb-1.5">Market Data</div>
                    <div className="space-y-1 text-2xs">
                      {ask && (
                        <div className="flex justify-between gap-4">
                          <span className="text-dim">Lowest Ask:</span>
                          <span className="text-orange-600 dark:text-orange-400 font-mono font-semibold">£{ask.toLocaleString()}</span>
                        </div>
                      )}
                      {bid && (
                        <div className="flex justify-between gap-4">
                          <span className="text-dim">Highest Bid:</span>
                          <span className="text-green-600 dark:text-green-400 font-mono font-semibold">£{bid.toLocaleString()}</span>
                        </div>
                      )}
                      {spread && (
                        <div className="flex justify-between gap-4 pt-1 border-t border-border">
                          <span className="text-dim">Spread:</span>
                          <span className="font-mono">£{spread.toFixed(0)} ({spreadPct}%)</span>
                        </div>
                      )}
                      <div className="pt-1 border-t border-border text-dim">
                        StockX • {new Date(asOf).toLocaleString()}
                      </div>
                    </div>
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
        cell: (info) => {
          const item = info.row.original
          return (
            <RowActions
              status={item.status || 'active'}
              onEdit={() => onEdit?.(item)}
              onToggleSold={() => onToggleSold?.(item)}
              onAddExpense={() => onAddExpense?.(item)}
              onAddToWatchlist={() => onAddToWatchlist?.(item)}
              stockxMapped={item.stockx_mapping_status === 'mapped'}
              stockxListingStatus={item.stockx_listing_status}
              onListOnStockX={onListOnStockX ? () => onListOnStockX(item) : undefined}
              onRepriceListing={onRepriceListing ? () => onRepriceListing(item) : undefined}
              onDeactivateListing={onDeactivateListing ? () => onDeactivateListing(item) : undefined}
              onReactivateListing={onReactivateListing ? () => onReactivateListing(item) : undefined}
              onDeleteListing={onDeleteListing ? () => onDeleteListing(item) : undefined}
            />
          )
        },
      }),
    ],
    [
      onEdit,
      onToggleSold,
      onAddExpense,
      onAddToWatchlist,
      onListOnStockX,
      onRepriceListing,
      onDeactivateListing,
      onReactivateListing,
      onDeleteListing,
      convert,
      format,
    ]
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
            Your portfolio is empty
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
