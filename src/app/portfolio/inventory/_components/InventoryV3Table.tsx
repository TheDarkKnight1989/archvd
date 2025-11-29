'use client'

/**
 * InventoryV3Table - Complete refactor with bulk-select and actions
 *
 * Columns (in exact order):
 * 0. Checkbox - bulk selection
 * 1. Name - brand + model/title with inline status badges (sortable)
 * 2. Size (user's preferred system) - UK/US/EU display (sortable)
 * 3. Status (Listed / Unlisted) - derived from listing mapping (sortable)
 * 4. Unrealised P/L - pl field (sortable)
 * 5. Purchase Price - invested (purchase_price + tax + shipping) (sortable)
 * 6. Market Value - market.price (sortable)
 * 7. Last Sold (Alias only) - alias.lastSoldPrice (sortable)
 * 8. Highest Bid (with platform badge) - stockx.highestBid + PlatformBadge (sortable)
 * 9. Listed Price - COLORED GREEN (sortable)
 * 10. Spread % - difference between listed and bid - COLOR CODED (sortable)
 * 11. Performance % - performancePct (sortable)
 * 12. Platform Listed (with badges) - platform if listed (sortable)
 * 13. Purchase Date - purchase_date (sortable)
 * 14. Actions - three-dot menu
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
import { generateProductSlug } from '@/lib/utils/slug'

const columnHelper = createColumnHelper<EnrichedLineItem>()

export interface InventoryV3TableProps {
  items: EnrichedLineItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  onRowClick?: (item: EnrichedLineItem) => void
  platform?: 'stockx' | 'alias' // Platform filter for data sources
  // Bulk selection
  selectedItems?: Set<string>
  onSelectionChange?: (selectedIds: Set<string>) => void
  // Item actions
  onEdit?: (item: EnrichedLineItem) => void
  onDuplicate?: (item: EnrichedLineItem) => void
  onAdjustTaxRate?: (item: EnrichedLineItem) => void
  onDelete?: (item: EnrichedLineItem) => void
  // StockX actions
  onListOnStockX?: (item: EnrichedLineItem) => void
  onRepriceListing?: (item: EnrichedLineItem) => void
  onDeactivateListing?: (item: EnrichedLineItem) => void
  onReactivateListing?: (item: EnrichedLineItem) => void
  onDeleteListing?: (item: EnrichedLineItem) => void
  onPrintStockXLabel?: (item: EnrichedLineItem) => void
  // Alias actions
  onPlaceAliasListing?: (item: EnrichedLineItem) => void
  onEditAliasListing?: (item: EnrichedLineItem) => void
  onCancelAliasListing?: (item: EnrichedLineItem) => void
  // Status actions
  onAddToWatchlist?: (item: EnrichedLineItem) => void
  onAddToSellList?: (item: EnrichedLineItem) => void
  onMarkListed?: (item: EnrichedLineItem) => void
  onMarkSold?: (item: EnrichedLineItem) => void
  onMarkUnlisted?: (item: EnrichedLineItem) => void
  onTogglePersonals?: (item: EnrichedLineItem) => void
  onAddExpense?: (item: EnrichedLineItem) => void
}

export function InventoryV3Table({
  items,
  loading,
  sorting,
  onSortingChange,
  onRowClick,
  platform = 'stockx',
  selectedItems = new Set(),
  onSelectionChange,
  // Item actions
  onEdit,
  onDuplicate,
  onAdjustTaxRate,
  onDelete,
  // StockX actions
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onPrintStockXLabel,
  // Alias actions
  onPlaceAliasListing,
  onEditAliasListing,
  onCancelAliasListing,
  // Status actions
  onAddToWatchlist,
  onAddToSellList,
  onMarkListed,
  onMarkSold,
  onMarkUnlisted,
  onTogglePersonals,
  onAddExpense,
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

      // 1. Name - brand + model/title
      columnHelper.accessor(
        (row) => `${row.brand || ''} ${row.model || ''}`.trim(),
        {
          id: 'name',
          header: 'Name',
          cell: (info) => {
            const item = info.row.original

            // Generate clean slug-based URL for market page with itemId for position data
            const productName = `${item.brand || ''} ${item.model || ''}`.trim()
            const sku = item.sku || ''
            const slug = sku ? generateProductSlug(productName, sku) : null
            const marketHref = slug ? `/portfolio/market/${slug}?itemId=${item.id}` : `/portfolio/inventory/market/${item.id}`

            return (
              <div className="min-w-[350px]">
                <ProductLineItem
                  imageUrl={item.image?.url || null}
                  imageAlt={item.image?.alt || `${item.brand} ${item.model}`}
                  brand={item.brand || ''}
                  model={item.model || ''}
                  variant={item.colorway || undefined}
                  sku={item.sku}
                  href={marketHref}
                  sizeUk={item.size_uk ? parseFloat(String(item.size_uk)) : undefined}
                  sizeSystem="UK"
                  category={(item.category?.toLowerCase() as any) || 'other'}
                />
              </div>
            )
          },
          enableSorting: true,
        }
      ),

      // 2. Size (user's preferred system)
      columnHelper.accessor('size_uk', {
        id: 'size',
        header: () => <div className="text-center w-16 opacity-70">Size (UK)</div>,
        cell: (info) => {
          const sizeUk = info.getValue()
          if (!sizeUk) return <div className="text-center text-dim/50 w-16">—</div>

          return (
            <div className="text-center mono text-sm w-16 tabular-nums">
              {sizeUk}
            </div>
          )
        },
        enableSorting: true,
        size: 70,
      }),

      // 3. Status (Listed / Unlisted)
      columnHelper.accessor(
        (row) => {
          const isListed = !!row.stockx?.listingId && (row.stockx?.listingStatus === 'ACTIVE' || row.stockx?.listingStatus === 'PENDING')
          return isListed ? 'Listed' : 'Unlisted'
        },
        {
          id: 'status',
          header: () => <div className="text-center w-24 opacity-70">Status</div>,
          cell: (info) => {
            const item = info.row.original
            const isListed = !!item.stockx?.listingId && (item.stockx?.listingStatus === 'ACTIVE' || item.stockx?.listingStatus === 'PENDING')

            return (
              <div className="text-center w-24">
                {isListed ? (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-semibold shadow-sm shadow-emerald-500/10 whitespace-nowrap">
                    Listed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/10 text-muted border-muted/30 whitespace-nowrap">
                    Unlisted
                  </Badge>
                )}
              </div>
            )
          },
          enableSorting: true,
          size: 100,
        }
      ),

      // 4. Unrealised P/L
      columnHelper.accessor('pl', {
        id: 'unrealised_pl',
        header: () => <div className="text-right opacity-70">Unrealised P/L {symbol()}</div>,
        cell: (info) => {
          const pl = info.getValue()
          const converted = pl !== null && pl !== undefined ? convert(pl, 'GBP') : null

          return (
            <div className="text-right mono tabular-nums">
              <MoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 5. Purchase Price (invested = purchase_price + tax + shipping)
      columnHelper.accessor('invested', {
        id: 'purchase_price',
        header: () => <div className="text-right opacity-70">Purchase {symbol()}</div>,
        cell: (info) => {
          const price = info.getValue()
          const converted = price ? convert(price, 'GBP') : null

          return (
            <div className="text-right mono tabular-nums">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 6. Market Value
      columnHelper.accessor('market.price', {
        id: 'market_value',
        header: () => <div className="text-right opacity-70">Market {symbol()}</div>,
        cell: (info) => {
          const item = info.row.original

          // Use platform-specific market data
          let price: number | null = null
          let displayCurrency = currency

          if (platform === 'alias') {
            // Alias: use lowestAsk from alias data (always USD, no conversion)
            price = item.alias?.lowestAsk ?? null
            displayCurrency = 'USD'
          } else {
            // StockX: use market.price with conversion
            const rawPrice = info.getValue()
            const marketCurrency = item.market?.currency || 'GBP'
            price = rawPrice ? convert(rawPrice, marketCurrency) : null
            displayCurrency = currency
          }

          return (
            <div className="text-right mono tabular-nums">
              <PlainMoneyCell value={price} currency={displayCurrency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      // 7. Last Sold (Alias only)
      ...(platform === 'alias' ? [
        columnHelper.accessor(
          (row) => row.alias?.lastSoldPrice ?? null,
          {
            id: 'last_sold',
            header: () => <div className="text-right opacity-70">Last Sold</div>,
            cell: (info) => {
              const item = info.row.original
              const lastSold = item.alias?.lastSoldPrice ?? null

              if (!lastSold) {
                return <div className="text-right text-dim/50">—</div>
              }

              return (
                <div className="text-right mono tabular-nums">
                  <PlainMoneyCell value={lastSold} currency="USD" />
                </div>
              )
            },
            enableSorting: true,
            sortUndefined: 1,
          }
        )
      ] : []),

      // 8. Highest Bid (with platform badge)
      columnHelper.accessor(
        (row) => {
          if (platform === 'alias') {
            return row.alias?.highestBid ?? null
          }
          return row.instantSell?.gross ?? row.stockx?.highestBid ?? null
        },
        {
          id: 'highest_bid',
          header: () => <div className="text-right opacity-70">Highest Bid</div>,
          cell: (info) => {
            const item = info.row.original
            let highestBid: number | null = null
            let displayCurrency = currency

            if (platform === 'alias') {
              // Alias: use highestBid from alias data (always USD, no conversion)
              highestBid = item.alias?.highestBid ?? null
              displayCurrency = 'USD'
            } else {
              // StockX: use instantSell/highestBid with conversion
              const rawBid = item.instantSell?.gross ?? item.stockx?.highestBid ?? null
              const sourceCurrency = item.instantSell?.currency || 'GBP'
              highestBid = rawBid && sourceCurrency !== currency
                ? convert(rawBid, sourceCurrency)
                : rawBid
              displayCurrency = currency
            }

            if (!highestBid) {
              return <div className="text-right text-dim/50">—</div>
            }

            return (
              <div className="flex items-center justify-end gap-2">
                <div className="text-right mono tabular-nums">
                  <PlainMoneyCell value={highestBid} currency={displayCurrency} />
                </div>
                <PlatformBadge platform={platform} compact />
              </div>
            )
          },
          enableSorting: true,
          sortUndefined: 1, // Push undefined/null values to the end
        }
      ),

      // 9. Listed Price (if listed) - with color
      columnHelper.accessor(
        (row) => platform === 'alias' ? (row.alias?.askPrice ?? null) : (row.stockx?.askPrice ?? null),
        {
          id: 'listing_price',
          header: () => <div className="text-right opacity-70">Listed {symbol()}</div>,
          cell: (info) => {
            const item = info.row.original
            let askPrice: number | null = null
            let isListed = false
            let displayCurrency = currency

            if (platform === 'alias') {
              // Alias: listings are in USD, no conversion
              askPrice = item.alias?.askPrice ?? null
              isListed = !!item.alias?.listingId
              displayCurrency = 'USD'
            } else {
              // StockX: listings are in GBP, no conversion needed
              askPrice = item.stockx?.askPrice ?? null
              isListed = !!item.stockx?.listingId
              displayCurrency = currency
            }

            if (!isListed || !askPrice) {
              return <div className="text-right text-dim/50">—</div>
            }

            return (
              <div className="text-right mono tabular-nums text-emerald-500">
                <PlainMoneyCell value={askPrice} currency={displayCurrency} />
              </div>
            )
          },
          enableSorting: true,
          sortUndefined: 1, // Push undefined/null values to the end
        }
      ),

      // 10. Spread % (difference between listed price and highest bid)
      columnHelper.accessor(
        (row) => {
          const askPrice = platform === 'alias' ? (row.alias?.askPrice ?? null) : (row.stockx?.askPrice ?? null)
          const highestBid = platform === 'alias' ? (row.alias?.highestBid ?? null) : (row.instantSell?.gross ?? row.stockx?.highestBid ?? null)

          if (!askPrice || !highestBid) return null

          // Calculate spread as percentage: ((listed - bid) / bid) * 100
          return ((askPrice - highestBid) / highestBid) * 100
        },
        {
          id: 'spread',
          header: () => <div className="text-right opacity-70">Spread</div>,
          cell: (info) => {
            const spreadPct = info.getValue()

            if (spreadPct === null || spreadPct === undefined) {
              return <div className="text-right text-dim/50">—</div>
            }

            // Color code: green if <5%, red if >25%, yellow otherwise
            let colorClass = 'text-yellow-500'
            if (spreadPct < 5) {
              colorClass = 'text-emerald-500'
            } else if (spreadPct >= 25) {
              colorClass = 'text-red-500'
            }

            return (
              <div className={cn("text-right mono tabular-nums", colorClass)}>
                {spreadPct > 0 ? '+' : ''}{spreadPct.toFixed(1)}%
              </div>
            )
          },
          enableSorting: true,
          sortUndefined: 1,
        }
      ),

      // 11. Performance %
      columnHelper.accessor('performancePct', {
        id: 'performance',
        header: () => <div className="text-right opacity-70">Performance</div>,
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

      // 12. Platform Listed (with badges)
      columnHelper.accessor(
        (row) => {
          const isListed = !!row.stockx?.listingId && (row.stockx?.listingStatus === 'ACTIVE' || row.stockx?.listingStatus === 'PENDING')
          return isListed ? 'StockX' : ''
        },
        {
          id: 'platform_listed',
          header: () => <div className="text-center w-28 opacity-70">Platform</div>,
          cell: (info) => {
            const item = info.row.original
            const isListed = !!item.stockx?.listingId && (item.stockx?.listingStatus === 'ACTIVE' || item.stockx?.listingStatus === 'PENDING')

            if (!isListed) {
              return <div className="text-center text-dim/50 w-28">—</div>
            }

            // Currently only StockX, but designed for future platforms
            return (
              <div className="flex justify-center w-28">
                <PlatformBadge platform="stockx" />
              </div>
            )
          },
          enableSorting: true,
          size: 110,
        }
      ),

      // 13. Purchase Date
      columnHelper.accessor('purchase_date', {
        id: 'purchase_date',
        header: () => <div className="text-center opacity-70">Purchase Date</div>,
        cell: (info) => {
          const date = info.getValue()
          if (!date) return <div className="text-center text-dim/50">—</div>

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

      // 14. Actions column (three-dot menu)
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-center opacity-70">Actions</div>,
        cell: (info) => {
          const item = info.row.original
          const stockxMapped = !!item.stockx?.mapped && !!item.stockx?.productId && !!item.stockx?.variantId
          const stockxListingStatus = item.stockx?.listingStatus || null
          const aliasListingStatus = item.alias?.listingStatus || null

          return (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <RowActions
                status={item.status || 'active'}
                // Item actions
                onEdit={() => onEdit?.(item)}
                onDuplicate={onDuplicate ? () => onDuplicate(item) : undefined}
                onAdjustTaxRate={onAdjustTaxRate ? () => onAdjustTaxRate(item) : undefined}
                onDelete={onDelete ? () => onDelete(item) : undefined}
                // StockX actions
                stockxMapped={stockxMapped}
                stockxListingStatus={stockxListingStatus}
                onListOnStockX={onListOnStockX ? () => onListOnStockX(item) : undefined}
                onRepriceListing={onRepriceListing ? () => onRepriceListing(item) : undefined}
                onDeactivateListing={onDeactivateListing ? () => onDeactivateListing(item) : undefined}
                onReactivateListing={onReactivateListing ? () => onReactivateListing(item) : undefined}
                onDeleteListing={onDeleteListing ? () => onDeleteListing(item) : undefined}
                onPrintStockXLabel={onPrintStockXLabel ? () => onPrintStockXLabel(item) : undefined}
                // Alias actions
                aliasListingStatus={aliasListingStatus}
                onPlaceAliasListing={onPlaceAliasListing ? () => onPlaceAliasListing(item) : undefined}
                onEditAliasListing={onEditAliasListing ? () => onEditAliasListing(item) : undefined}
                onCancelAliasListing={onCancelAliasListing ? () => onCancelAliasListing(item) : undefined}
                // Status actions
                onAddToWatchlist={onAddToWatchlist ? () => onAddToWatchlist(item) : undefined}
                onAddToSellList={onAddToSellList ? () => onAddToSellList(item) : undefined}
                onMarkListed={onMarkListed ? () => onMarkListed(item) : undefined}
                onMarkSold={() => onMarkSold?.(item)}
                onMarkUnlisted={onMarkUnlisted ? () => onMarkUnlisted(item) : undefined}
                onTogglePersonals={onTogglePersonals ? () => onTogglePersonals(item) : undefined}
              />
            </div>
          )
        },
        enableSorting: false,
      }),
    ],
    [
      convert,
      format,
      symbol,
      currency,
      selectedItems,
      allSelected,
      someSelected,
      onSelectionChange,
      // Item actions
      onEdit,
      onDuplicate,
      onAdjustTaxRate,
      onDelete,
      // StockX actions
      onListOnStockX,
      onRepriceListing,
      onDeactivateListing,
      onReactivateListing,
      onDeleteListing,
      onPrintStockXLabel,
      // Alias actions
      onPlaceAliasListing,
      onEditAliasListing,
      onCancelAliasListing,
      // Status actions
      onAddToWatchlist,
      onAddToSellList,
      onMarkListed,
      onMarkSold,
      onMarkUnlisted,
      onTogglePersonals,
      onAddExpense,
    ]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      console.log('[InventoryV3Table] Sort change triggered', { currentSorting: sorting, updater })
      onSortingChange(updater)
    },
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
              {headerGroup.headers.map((header) => {
                const isSorted = header.column.getIsSorted()
                const canSort = header.column.getCanSort()

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      canSort && 'cursor-pointer select-none hover:bg-soft/30 transition-colors',
                      'whitespace-nowrap group'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className={cn(
                          'text-xs transition-opacity',
                          isSorted ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                        )}>
                          {isSorted === 'asc' ? '↑' : isSorted === 'desc' ? '↓' : '↕'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                )
              })}
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
