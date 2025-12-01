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

import React, { useMemo } from 'react'
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
import Link from 'next/link'
import { ExternalLink, ArrowUpDown } from 'lucide-react'

const columnHelper = createColumnHelper<EnrichedLineItem>()

/**
 * DesktopNameCell - Premium 3-line vertical layout for desktop inventory table
 *
 * Structure:
 * - Line 1: Product Name (font-medium, text-[15px], tracking-tight)
 * - Line 2: Variant/Colorway (text-sm, text-muted-foreground)
 * - Line 3: Metadata (Size UK, SKU) (text-[11px], text-muted-foreground/70)
 */
interface DesktopNameCellProps {
  item: EnrichedLineItem
  href: string
}

function DesktopNameCell({ item, href }: DesktopNameCellProps) {
  // Only show brand if model doesn't already start with it (prevents "Nike Nike...")
  const productName = item.model?.trim().toLowerCase().startsWith(item.brand?.toLowerCase() || '')
    ? item.model.trim()
    : `${item.brand || ''} ${item.model || ''}`.trim()

  // Build metadata array: size UK, SKU
  const metadataParts = [
    item.size_uk ? `UK ${item.size_uk}` : null,
    item.sku
  ].filter(Boolean)

  return (
    <div className="flex items-center gap-2.5 group">
      {/* Image Thumbnail - 48px with subtle frame */}
      <div className="h-12 w-12 rounded-md shadow-sm ring-1 ring-black/10 overflow-hidden flex-shrink-0 bg-black/40 transition-transform duration-200 group-hover:-translate-y-[0.5px] relative flex items-center justify-center">
        {item.image?.url ? (
          <img
            src={item.image.url}
            alt={item.image.alt || productName}
            className="object-cover w-full h-full"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-elev-2 text-[11px] font-medium text-dim">
            {item.brand?.slice(0, 2).toUpperCase() || 'IT'}
          </div>
        )}

        {/* StockX badge overlay */}
        {item.imageSource === 'stockx' && item.image?.url && (
          <div className="absolute bottom-0.5 right-0.5 bg-emerald-600 text-white text-[9px] font-semibold px-1 py-0.5 rounded-full leading-none shadow-sm">
            S
          </div>
        )}
      </div>

      {/* Text Content - 2-line hierarchy: name + metadata */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Primary name */}
        <div className="flex items-center gap-1">
          <Link
            href={href}
            className="text-sm font-medium text-white leading-tight tracking-tight hover:text-muted transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:rounded"
            aria-label={`View ${productName} details`}
          >
            {productName}
          </Link>
          <Link
            href={href}
            className="flex-shrink-0 text-muted-foreground/70 hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:rounded opacity-0 group-hover:opacity-100"
            aria-hidden="true"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>

        {/* Secondary metadata: size • SKU (more subtle) */}
        {metadataParts.length > 0 && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55 leading-tight truncate">
            {metadataParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className="text-white/30">•</span>
                )}
                <span className={cn("tabular-nums", idx > 0 && "font-mono")}>
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export interface InventoryV3TableProps {
  items: EnrichedLineItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  onRowClick?: (item: EnrichedLineItem) => void
  platform?: 'stockx' | 'alias' // Platform filter for data sources
  // Column visibility
  columnVisibility?: Record<string, boolean>
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
  columnVisibility = {},
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
          <div className="flex items-center justify-center">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
              onClick={(e) => e.stopPropagation()}
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
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium text-white/80">Name</span>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
          cell: (info) => {
            const item = info.row.original

            // Generate clean slug-based URL for market page with itemId for position data
            const productName = `${item.brand || ''} ${item.model || ''}`.trim()
            const sku = item.sku || ''
            const slug = sku ? generateProductSlug(productName, sku) : null
            const marketHref = slug ? `/portfolio/market/${slug}?itemId=${item.id}` : `/portfolio/inventory/market/${item.id}`

            return (
              <div className="max-w-[320px] min-w-[260px]">
                <DesktopNameCell item={item} href={marketHref} />
              </div>
            )
          },
          enableSorting: true,
        }
      ),

      // 2. Size (user's preferred system)
      columnHelper.accessor('size_uk', {
        id: 'size',
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-center gap-1 w-16">
              <div className="flex flex-col items-center leading-[1.1]">
                <span className="text-xs font-medium text-white/80">Size</span>
                <span className="text-[10px] text-white/50">UK</span>
              </div>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
        cell: (info) => {
          const sizeUk = info.getValue()
          if (!sizeUk) return <div className="text-center text-dim/50 w-16">—</div>

          return (
            <div className="text-center mono text-[11px] text-muted w-16 tabular-nums">
              {sizeUk}
            </div>
          )
        },
        enableSorting: true,
        size: 70,
      }),

      // 3. Status (Listed / Paused / Unlisted)
      columnHelper.accessor(
        (row) => {
          const status = row.stockx?.listingStatus
          if (status === 'ACTIVE' || status === 'PENDING') return 'Listed'
          if (status === 'INACTIVE') return 'Paused'
          return 'Unlisted'
        },
        {
          id: 'status',
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-center gap-1 w-20">
                <span className="text-xs font-medium text-white/80">Status</span>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
          cell: (info) => {
            const item = info.row.original
            const status = item.stockx?.listingStatus

            // Active or Pending → Green "Listed"
            if (status === 'ACTIVE' || status === 'PENDING') {
              return (
                <div className="text-center w-20">
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-semibold shadow-sm shadow-emerald-500/10 whitespace-nowrap text-[11px] px-2 py-0.5">
                    Listed
                  </Badge>
                </div>
              )
            }

            // Inactive → Yellow "Paused"
            if (status === 'INACTIVE') {
              return (
                <div className="text-center w-20">
                  <Badge variant="outline" className="bg-amber-400/20 text-amber-300 border-amber-400/50 font-semibold shadow-sm shadow-amber-400/10 whitespace-nowrap text-[11px] px-2 py-0.5">
                    Paused
                  </Badge>
                </div>
              )
            }

            // No listing → Gray "Unlisted"
            return (
              <div className="text-center w-20">
                <Badge variant="outline" className="bg-muted/10 text-muted border-muted/30 whitespace-nowrap text-[11px] px-2 py-0.5">
                  Unlisted
                </Badge>
              </div>
            )
          },
          enableSorting: true,
          size: 90,
        }
      ),

      // 4. Unrealised P/L
      columnHelper.accessor('pl', {
        id: 'unrealised_pl',
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-end gap-1">
              <div className="flex flex-col items-end leading-[1.1]">
                <span className="text-xs font-medium text-white/80">Unrealised</span>
                <span className="text-[10px] text-white/50">P/L {symbol()}</span>
              </div>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
        cell: (info) => {
          const pl = info.getValue()
          const converted = pl !== null && pl !== undefined ? convert(pl, 'GBP') : null

          return (
            <div className="text-right mono tabular-nums text-xs leading-tight">
              <MoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
        size: 110,
      }),

      // 5. Purchase Price (invested = purchase_price + tax + shipping)
      columnHelper.accessor('invested', {
        id: 'purchase_price',
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-end gap-1">
              <div className="flex flex-col items-end leading-[1.1]">
                <span className="text-xs font-medium text-white/80">Buy</span>
                <span className="text-[10px] text-white/50">{symbol()}</span>
              </div>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
        cell: (info) => {
          const price = info.getValue()
          const converted = price ? convert(price, 'GBP') : null

          return (
            <div className="text-right mono tabular-nums text-xs text-muted leading-tight">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
        size: 100,
      }),

      // 6. Market Value
      columnHelper.accessor('market.price', {
        id: 'market_value',
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-end gap-1">
              <div className="flex flex-col items-end leading-[1.1]">
                <span className="text-xs font-medium text-white/80">Market</span>
                <span className="text-[10px] text-white/50">{symbol()}</span>
              </div>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
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
            <div className="text-right mono tabular-nums text-xs text-muted leading-tight">
              <PlainMoneyCell value={price} currency={displayCurrency} />
            </div>
          )
        },
        enableSorting: true,
        size: 100,
      }),

      // 7. Last Sold (Alias only)
      ...(platform === 'alias' ? [
        columnHelper.accessor(
          (row) => row.alias?.lastSoldPrice ?? null,
          {
            id: 'last_sold',
            header: (info) => {
              const isSorted = info.column.getIsSorted()
              return (
                <div className="flex items-center justify-end gap-1">
                  <span className="text-xs font-medium text-white/80">Last Sold</span>
                  <ArrowUpDown
                    className={cn(
                      'h-3 w-3 transition-opacity flex-shrink-0',
                      isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                    )}
                  />
                </div>
              )
            },
            cell: (info) => {
              const item = info.row.original
              const lastSold = item.alias?.lastSoldPrice ?? null

              if (!lastSold) {
                return <div className="text-right text-dim/50">—</div>
              }

              return (
                <div className="text-right mono tabular-nums text-xs text-muted leading-tight">
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
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-end gap-1">
                <div className="flex flex-col items-end leading-[1.1]">
                  <span className="text-xs font-medium text-white/80">Bid</span>
                  <span className="text-[10px] text-white/50">{symbol()}</span>
                </div>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
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
                <div className="text-right mono tabular-nums text-xs text-muted leading-tight">
                  <PlainMoneyCell value={highestBid} currency={displayCurrency} />
                </div>
                <PlatformBadge platform={platform} compact />
              </div>
            )
          },
          enableSorting: true,
          sortUndefined: 1, // Push undefined/null values to the end
          size: 110,
        }
      ),

      // 9. Listed Price (if listed) - with color
      columnHelper.accessor(
        (row) => platform === 'alias' ? (row.alias?.askPrice ?? null) : (row.stockx?.askPrice ?? null),
        {
          id: 'listing_price',
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-end gap-1">
                <div className="flex flex-col items-end leading-[1.1]">
                  <span className="text-xs font-medium text-white/80">Ask</span>
                  <span className="text-[10px] text-white/50">{symbol()}</span>
                </div>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
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
              <div className="text-right mono tabular-nums text-xs text-emerald-500 leading-tight">
                <PlainMoneyCell value={askPrice} currency={displayCurrency} />
              </div>
            )
          },
          enableSorting: true,
          sortUndefined: 1, // Push undefined/null values to the end
          size: 100,
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
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs font-medium text-white/80">Spread</span>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
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
              <div className={cn("text-right mono tabular-nums text-xs leading-tight", colorClass)}>
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
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-end gap-1">
              <div className="flex flex-col items-end leading-[1.1]">
                <span className="text-xs font-medium text-white/80">Perf</span>
                <span className="text-[10px] text-white/50">%</span>
              </div>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
        cell: (info) => {
          const pct = info.getValue()

          return (
            <div className="text-right mono tabular-nums text-xs leading-tight">
              <PercentCell value={pct} />
            </div>
          )
        },
        enableSorting: true,
        size: 90,
      }),

      // 12. Platform Listed (with badges)
      columnHelper.accessor(
        (row) => {
          const status = row.stockx?.listingStatus
          const hasListing = !!row.stockx?.listingId && (status === 'ACTIVE' || status === 'PENDING' || status === 'INACTIVE')
          return hasListing ? 'StockX' : ''
        },
        {
          id: 'platform_listed',
          header: (info) => {
            const isSorted = info.column.getIsSorted()
            return (
              <div className="flex items-center justify-center gap-1 w-28">
                <span className="text-xs font-medium text-white/80">Platform</span>
                <ArrowUpDown
                  className={cn(
                    'h-3 w-3 transition-opacity flex-shrink-0',
                    isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                  )}
                />
              </div>
            )
          },
          cell: (info) => {
            const item = info.row.original
            const status = item.stockx?.listingStatus
            const hasListing = !!item.stockx?.listingId && (status === 'ACTIVE' || status === 'PENDING' || status === 'INACTIVE')

            if (!hasListing) {
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
        header: (info) => {
          const isSorted = info.column.getIsSorted()
          return (
            <div className="flex items-center justify-center gap-1">
              <span className="text-xs font-medium text-white/80">Purchase Date</span>
              <ArrowUpDown
                className={cn(
                  'h-3 w-3 transition-opacity flex-shrink-0',
                  isSorted ? 'text-white/70 opacity-100' : 'text-white/30 opacity-100 group-hover:opacity-80'
                )}
              />
            </div>
          )
        },
        cell: (info) => {
          const date = info.getValue()
          if (!date) return <div className="text-center text-dim/50">—</div>

          const formatted = new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })

          return (
            <div className="text-center text-[11px] text-muted mono leading-tight">
              {formatted}
            </div>
          )
        },
        enableSorting: true,
      }),

      // 14. Actions column (three-dot menu)
      columnHelper.display({
        id: 'actions',
        header: () => (
          <div className="text-center">
            <span className="text-xs font-medium text-white">Actions</span>
          </div>
        ),
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
    state: {
      sorting,
      columnVisibility,
    },
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
    <div className="max-w-[1650px] mx-auto">
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
                      canSort && 'cursor-pointer select-none hover:bg-soft/20 transition-colors',
                      'group py-2 px-1.5 align-top'
                    )}
                    style={{
                      width: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                      minWidth: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                      maxWidth: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                    }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
              {row.getVisibleCells().map((cell) => {
                // Compact padding for all cells
                const cellPadding = 'py-1.5 px-1.5'

                return (
                  <TableCell
                    key={cell.id}
                    className={cellPadding}
                    style={{
                      width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined,
                      minWidth: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined,
                      maxWidth: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </TableBase>
    </TableWrapper>
    </div>
  )
}
