'use client'

import { useMemo, useState } from 'react'
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
import { DollarSign, MoreHorizontal, Copy, Package } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { PlainMoneyCell, MoneyCell, PercentCell } from '@/lib/format/money'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import { TableWrapper, TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import type { SalesItem } from '@/hooks/useSalesTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'

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
  const { convert, format, symbol, currency } = useCurrency()
  const router = useRouter()
  const [copiedSku, setCopiedSku] = useState<string | null>(null)

  // Copy SKU to clipboard
  const handleCopySku = async (sku: string) => {
    await navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    setTimeout(() => setCopiedSku(null), 2000)
  }

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'item',
        header: 'Item',
        cell: (info) => {
          const item = info.row.original

          return (
            <ProductLineItem
              imageUrl={item.image_url || null}
              imageAlt={`${item.brand} ${item.model}`}
              brand={item.brand || ''}
              model={item.model || ''}
              variant={undefined}
              sku={item.sku}
              href={`/product/${item.sku}`}
              sizeUk={item.size_uk}
              sizeSystem="UK"
              category={(item.category?.toLowerCase() as any) || 'other'}
              className="min-w-[280px]"
            />
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('purchase_price', {
        id: 'purchase_price',
        header: () => <div className="text-right">Buy {symbol()}</div>,
        cell: (info) => {
          const price = info.getValue()
          const tax = info.row.original.tax || 0
          const shipping = info.row.original.shipping || 0
          const total = price + tax + shipping
          const converted = convert(total, 'GBP')

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('sold_price', {
        id: 'sold_price',
        header: () => <div className="text-right">Sale {symbol()}</div>,
        cell: (info) => {
          const value = info.getValue()
          const converted = convert(value || 0, 'GBP')

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('commission', {
        id: 'commission',
        header: () => <div className="text-right">Fees {symbol()}</div>,
        cell: (info) => {
          const commission = info.getValue()
          const item = info.row.original
          const isStockX = item.platform?.toLowerCase() === 'stockx' || !!item.stockx_order_id

          // Only show commission for StockX sales
          if (!isStockX || !commission) {
            return <div className="text-right text-dim">—</div>
          }

          const converted = convert(commission, 'GBP')

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('net_payout', {
        id: 'net_payout',
        header: () => <div className="text-right">Net {symbol()}</div>,
        cell: (info) => {
          const netPayout = info.getValue()
          const item = info.row.original
          const isStockX = item.platform?.toLowerCase() === 'stockx' || !!item.stockx_order_id

          // Only show net payout for StockX sales
          if (!isStockX || !netPayout) {
            return <div className="text-right text-dim">—</div>
          }

          const converted = convert(netPayout, 'GBP')

          return (
            <div className="text-right mono">
              <PlainMoneyCell value={converted} currency={currency} />
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.accessor('margin_gbp', {
        id: 'margin_gbp',
        header: () => <div className="text-right">Realised Profit {symbol()}</div>,
        cell: (info) => {
          const value = info.getValue()
          const converted = convert(value || 0, 'GBP')

          return (
            <div className="text-right mono">
              <MoneyCell value={converted} showArrow currency={currency} />
            </div>
          )
        },
        enableSorting: true,
      }),

      columnHelper.accessor('margin_percent', {
        id: 'margin_percent',
        header: () => <div className="text-right">Margin %</div>,
        cell: (info) => (
          <div className="text-right mono">
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
            <div className="text-sm text-fg">
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

      columnHelper.accessor('platform', {
        id: 'platform',
        header: 'Platform',
        cell: (info) => {
          const platform = info.getValue()
          const platformLower = platform?.toLowerCase()

          // Platform badge styling
          const getPlatformBadge = () => {
            switch (platformLower) {
              case 'stockx':
                return {
                  label: 'StockX',
                  bg: 'bg-[#00B050]/10',
                  text: 'text-[#00B050]',
                  border: 'border-[#00B050]/30',
                  icon: 'Sx'
                }
              case 'alias':
                return {
                  label: 'Alias',
                  bg: 'bg-[#A855F7]/10',
                  text: 'text-[#A855F7]',
                  border: 'border-[#A855F7]/30',
                  icon: 'AL'
                }
              case 'ebay':
                return {
                  label: 'eBay',
                  bg: 'bg-[#E53238]/10',
                  text: 'text-[#E53238]',
                  border: 'border-[#E53238]/30',
                  icon: 'eB'
                }
              case 'private':
                return {
                  label: 'Private',
                  bg: 'bg-[#3B82F6]/10',
                  text: 'text-[#3B82F6]',
                  border: 'border-[#3B82F6]/30',
                  icon: 'Pr'
                }
              default:
                return {
                  label: platform || 'Other',
                  bg: 'bg-muted/10',
                  text: 'text-muted',
                  border: 'border-border',
                  icon: 'Ot'
                }
            }
          }

          if (!platform) {
            return <span className="text-dim">—</span>
          }

          const badge = getPlatformBadge()

          return (
            <div className="flex items-center gap-2">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium",
                badge.bg,
                badge.text,
                badge.border
              )}>
                <span className="font-bold text-[10px]">{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            </div>
          )
        },
        enableSorting: false,
      }),

      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const item = info.row.original

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger className="p-2 hover:bg-elev-1 rounded-md transition-colors">
                  <MoreHorizontal className="h-4 w-4 text-muted" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => router.push('/portfolio/inventory')}
                    className="cursor-pointer"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    View in Portfolio
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCopySku(item.sku)}
                    className="cursor-pointer"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copiedSku === item.sku ? 'Copied!' : 'Copy SKU'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        enableSorting: false,
      }),
    ],
    [convert, format, symbol, currency, copiedSku, router]
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
      <TableBase>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i} index={i}>
              {columns.map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </TableBase>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px] rounded-2xl border border-keyline bg-panel">
        <div className="text-center px-6 py-12">
          {/* Icon with accent glow */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
            <DollarSign className="h-16 w-16 mx-auto text-accent relative" strokeWidth={1.5} />
          </div>

          {/* Heading */}
          <h3 className="text-xl font-semibold text-fg mb-2">
            No sales yet
          </h3>

          {/* Description */}
          <p className="text-sm text-muted mb-8 max-w-sm mx-auto leading-relaxed">
            When you mark items as sold, they'll appear here with complete sale details and margin analysis.
          </p>
        </div>
      </div>
    )
  }

  return (
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
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
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
        {table.getRowModel().rows.map((row, idx) => (
          <TableRow key={row.id} index={idx}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </TableBase>
  )
}
