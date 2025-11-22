'use client'

/**
 * InventoryV3Table - Complete refactor with bulk-select and actions
 *
 * Columns (in exact order):
 * 0. Checkbox - bulk selection
 * 1. Name - brand + model/title with inline status badges
 * 2. Size (user's preferred system) - UK/US/EU display
 * 3. Status (Listed / Unlisted) - derived from listing mapping
 * 4. Unrealised P/L - pl field
 * 5. Purchase Price - invested (purchase_price + tax + shipping)
 * 6. Market Value - market.price
 * 7. Listing Price - stockx.askPrice (if listed)
 * 8. Highest Bid (with platform badge) - stockx.highestBid + PlatformBadge
 * 9. Performance % - performancePct
 * 10. Platform Listed (with badges) - platform if listed
 * 11. Purchase Date - purchase_date
 * 12. Actions - three-dot menu
 */

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
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { PlatformBadge } from '@/components/platform/PlatformBadge'
import { TableWrapper, TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import { RowActions } from './RowActions'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

const columnHelper = createColumnHelper<EnrichedLineItem>()

export interface InventoryV3TableProps {
  items: EnrichedLineItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  onRowClick?: (item: EnrichedLineItem) => void
  // Bulk selection
  selectedItems?: Set<string>
  onSelectionChange?: (selectedIds: Set<string>) => void
  // Row actions
  onEdit?: (item: EnrichedLineItem) => void
  onMarkSold?: (item: EnrichedLineItem) => void
  onAddExpense?: (item: EnrichedLineItem) => void
  onAddToWatchlist?: (item: EnrichedLineItem) => void
  onListOnStockX?: (item: EnrichedLineItem) => void
  onRepriceListing?: (item: EnrichedLineItem) => void
  onDeactivateListing?: (item: EnrichedLineItem) => void
  onReactivateListing?: (item: EnrichedLineItem) => void
  onDeleteListing?: (item: EnrichedLineItem) => void
  onDelete?: (item: EnrichedLineItem) => void
}

export function InventoryV3Table({
  items,
  loading,
  sorting,
  onSortingChange,
  onRowClick,
  selectedItems = new Set(),
  onSelectionChange,
  onEdit,
  onMarkSold,
  onAddExpense,
  onAddToWatchlist,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onDelete,
}: InventoryV3TableProps) {
  const { convert, format, symbol, currency } = useCurrency()

  // Select all / deselect all handler
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return

    if (checked) {
      const allIds = new Set(items.map(item => item.id))
      onSelectionChange(allIds)
    } else {
      onSelectionChange(new Set())
    }
  }

  // Toggle individual row selection
  const handleSelectRow = (itemId: string, checked: boolean) => {
    if (!onSelectionChange) return

    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    onSelectionChange(newSelection)
  }

  // Check if all visible items are selected
  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id)) && !allSelected

  // Define columns with bulk-select and actions
  const columns = useMemo(
    () => [
      // 0. Checkbox column (bulk select)
      columnHelper.display({
        id: 'select',
        header: () => (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
          </div>
        ),
        cell: (info) => {
          const item = info.row.original
          const isSelected = selectedItems.has(item.id)

          return (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                aria-label={`Select ${item.sku}`}
              />
            </div>
          )
        },
        enableSorting: false,
      }),

      // 1. Name - brand + model/title with inline status badges
      columnHelper.display({
        id: 'name',
        header: 'Name',
        cell: (info) => {
          const item = info.row.original
          const isListed = !!item.stockx?.listingId && item.stockx?.listingStatus === 'ACTIVE'

          return (
            <div className="flex items-start gap-3 min-w-[280px]">
              {/* Product line item with image, brand, model */}
              <ProductLineItem
                imageUrl={item.image_url || null}
                imageAlt={`${item.brand} ${item.model}`}
                brand={item.brand || ''}
                model={item.model || ''}
                variant={item.colorway || undefined}
                sku={item.sku}
                href={`/portfolio/inventory/market/${item.id}`}
                sizeUk={item.size_uk ? parseFloat(String(item.size_uk)) : undefined}
                sizeSystem="UK"
                category={(item.category?.toLowerCase() as any) || 'other'}
                className="flex-1"
              />

              {/* Inline status badges */}
              <div className="flex flex-col gap-1 items-end">
                {isListed && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                    Listed
                  </Badge>
                )}
                {item.condition && item.condition !== 'New' && (
                  <Badge variant="outline" className="text-xs">
                    {item.condition}
                  </Badge>
                )}
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      // 2. Size (user's preferred system)
      columnHelper.accessor('size_uk', {
        id: 'size',
        header: () => <div className="text-center">Size (UK)</div>,
        cell: (info) => {
          const sizeUk = info.getValue()
          if (!sizeUk) return <div className="text-center text-dim">—</div>

          return (
            <div className="text-center mono text-sm">
              {sizeUk}
            </div>
          )
        },
        enableSorting: true,
      }),

      // 3. Status (Listed / Unlisted)
      columnHelper.display({
        id: 'status',
        header: () => <div className="text-center">Status</div>,
        cell: (info) => {
          const item = info.row.original
          const isListed = !!item.stockx?.listingId && item.stockx?.listingStatus === 'ACTIVE'

          return (
            <div className="text-center">
              {isListed ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  Listed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted/10 text-muted border-muted/30">
                  Unlisted
                </Badge>
              )}
            </div>
          )
        },
        enableSorting: false,
      }),

      // 4. Unrealised P/L
      columnHelper.accessor('pl', {
        id: 'unrealised_pl',
        header: () => <div className="text-right">Unrealised P/L {symbol()}</div>,
        cell: (info) => {
          const pl = info.getValue()
          const converted = pl !== null && pl !== undefined ? convert(pl, 'GBP') : null

          return (
            <div className="text-right mono">
              <MoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 5. Purchase Price (invested = purchase_price + tax + shipping)
      columnHelper.accessor('invested', {
        id: 'purchase_price',
        header: () => <div className="text-right">Purchase {symbol()}</div>,
        cell: (info) => {
          const price = info.getValue()
          const converted = price ? convert(price, 'GBP') : null

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 6. Market Value
      columnHelper.accessor('market.price', {
        id: 'market_value',
        header: () => <div className="text-right">Market {symbol()}</div>,
        cell: (info) => {
          const price = info.getValue()
          const item = info.row.original
          const marketCurrency = item.market?.currency || 'GBP'
          const converted = price ? convert(price, marketCurrency) : null

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 7. Listing Price (if listed)
      columnHelper.display({
        id: 'listing_price',
        header: () => <div className="text-right">Ask {symbol()}</div>,
        cell: (info) => {
          const item = info.row.original
          const askPrice = item.stockx?.askPrice
          const isListed = !!item.stockx?.listingId

          if (!isListed || !askPrice) {
            return <div className="text-right text-dim">—</div>
          }

          const converted = convert(askPrice, 'USD') // StockX prices are USD

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: false,
      }),

      // 8. Highest Bid (with platform badge)
      columnHelper.display({
        id: 'highest_bid',
        header: () => <div className="text-right">Highest Bid</div>,
        cell: (info) => {
          const item = info.row.original
          const highestBid = item.stockx?.highestBid

          if (!highestBid) {
            return <div className="text-right text-dim">—</div>
          }

          const converted = convert(highestBid, 'USD')

          return (
            <div className="flex items-center justify-end gap-2">
              <div className="text-right mono">
                <PlainMoneyCell value={converted} currency={currency} />
              </div>
              <PlatformBadge platform="stockx" />
            </div>
          )
        },
        enableSorting: false,
      }),

      // 9. Performance %
      columnHelper.accessor('performancePct', {
        id: 'performance',
        header: () => <div className="text-right">Performance</div>,
        cell: (info) => {
          const pct = info.getValue()

          return (
            <div className="text-right mono">
              <PercentCell value={pct} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 10. Platform Listed (with badges)
      columnHelper.display({
        id: 'platform_listed',
        header: () => <div className="text-center">Platform</div>,
        cell: (info) => {
          const item = info.row.original
          const isListed = !!item.stockx?.listingId && item.stockx?.listingStatus === 'ACTIVE'

          if (!isListed) {
            return <div className="text-center text-dim">—</div>
          }

          // Currently only StockX, but designed for future platforms
          return (
            <div className="flex justify-center">
              <PlatformBadge platform="stockx" />
            </div>
          )
        },
        enableSorting: false,
      }),

      // 11. Purchase Date
      columnHelper.accessor('purchase_date', {
        id: 'purchase_date',
        header: () => <div className="text-center">Purchase Date</div>,
        cell: (info) => {
          const date = info.getValue()
          if (!date) return <div className="text-center text-dim">—</div>

          const formatted = new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })

          return (
            <div className="text-center text-sm mono">
              {formatted}
            </div>
          )
        },
        enableSorting: true,
      }),

      // 12. Actions column (three-dot menu)
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-center">Actions</div>,
        cell: (info) => {
          const item = info.row.original
          const stockxMapped = !!item.stockx?.mapped && !!item.stockx?.productId && !!item.stockx?.variantId
          const stockxListingStatus = item.stockx?.listingStatus || null

          return (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <RowActions
                status={item.status || 'active'}
                onEdit={() => onEdit?.(item)}
                onToggleSold={() => onMarkSold?.(item)}
                onAddExpense={() => onAddExpense?.(item)}
                onAddToWatchlist={() => onAddToWatchlist?.(item)}
                stockxMapped={stockxMapped}
                stockxListingStatus={stockxListingStatus}
                onListOnStockX={() => onListOnStockX?.(item)}
                onRepriceListing={() => onRepriceListing?.(item)}
                onDeactivateListing={() => onDeactivateListing?.(item)}
                onReactivateListing={() => onReactivateListing?.(item)}
                onDeleteListing={() => onDeleteListing?.(item)}
              />
            </div>
          )
        },
        enableSorting: false,
      }),
    ],
    [convert, format, symbol, currency, selectedItems, allSelected, someSelected, onSelectionChange, onEdit, onMarkSold, onAddExpense, onAddToWatchlist, onListOnStockX, onRepriceListing, onDeactivateListing, onReactivateListing, onDeleteListing]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Loading skeleton
  if (loading) {
    return (
      <TableWrapper>
        <TableBase>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </TableBase>
      </TableWrapper>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted text-sm">No inventory items yet</p>
      </div>
    )
  }

  return (
    <TableWrapper>
      <TableBase>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    header.column.getCanSort() && 'cursor-pointer select-none',
                    'whitespace-nowrap'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() && (
                    <span className="ml-1">
                      {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                'cursor-pointer hover:bg-soft/50 transition-colors',
                row.original.status === 'sold' && 'opacity-50'
              )}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableBase>
    </TableWrapper>
  )
}
