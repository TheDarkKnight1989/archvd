'use client'

/**
 * Ledger Table - Shows unified BUY and SELL transactions
 */

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
import { MoreHorizontal, Copy, Edit, Undo2, Info, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import { TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { LedgerRow } from '@/hooks/useLedger'

const columnHelper = createColumnHelper<LedgerRow>()

export interface LedgerTableProps {
  rows: LedgerRow[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
}

export function LedgerTable({
  rows,
  loading,
  sorting,
  onSortingChange,
}: LedgerTableProps) {
  const { convert, format } = useCurrency()
  const [copiedSku, setCopiedSku] = useState<string | null>(null)

  // Copy SKU to clipboard
  const handleCopySku = async (sku: string) => {
    await navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    setTimeout(() => setCopiedSku(null), 2000)
  }

  // Type badge component
  const TypeBadge = ({ type }: { type: 'BUY' | 'SELL' }) => {
    const isBuy = type === 'BUY'
    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold",
        isBuy
          ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      )}>
        {isBuy ? (
          <ArrowDownLeft className="h-3 w-3" />
        ) : (
          <ArrowUpRight className="h-3 w-3" />
        )}
        {type}
      </span>
    )
  }

  // Amount tooltip breakdown for SELL rows
  const AmountTooltipContent = ({ row }: { row: LedgerRow }) => {
    if (row.type !== 'SELL') return null

    const salePrice = row.sold_price || 0
    const fees = row.sales_fee || 0
    const costBasis = row.purchase_price || 0
    const profit = row.profit || 0

    return (
      <div className="text-xs space-y-1.5 min-w-[160px]">
        <div className="flex justify-between">
          <span className="text-muted">Sale Price</span>
          <span className="mono">{format(convert(salePrice, 'GBP'))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Fees</span>
          <span className="mono text-red-400">-{format(convert(fees, 'GBP'))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Cost Basis</span>
          <span className="mono text-red-400">-{format(convert(costBasis, 'GBP'))}</span>
        </div>
        <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
          <span>{profit >= 0 ? 'Profit' : 'Loss'}</span>
          <span
            className="mono"
            style={{ color: profit >= 0 ? '#00FF94' : '#F87171' }}
          >
            {profit >= 0 ? '+' : ''}{format(convert(profit, 'GBP'))}
          </span>
        </div>
      </div>
    )
  }

  const columns = useMemo(
    () => [
      // Type column
      columnHelper.accessor('type', {
        id: 'type',
        header: 'Type',
        cell: (info) => <TypeBadge type={info.getValue()} />,
        enableSorting: false,
      }),

      // Item column
      columnHelper.display({
        id: 'item',
        header: 'Item',
        cell: (info) => {
          const row = info.row.original
          return (
            <ProductLineItem
              imageUrl={row.image_url || null}
              imageAlt={`${row.brand} ${row.model}`}
              brand={row.brand || ''}
              model={row.model || ''}
              variant={undefined}
              sku={row.sku}
              href={`/product/${row.sku}`}
              sizeUk={row.size_uk}
              sizeSystem="UK"
              category={(row.category?.toLowerCase() as 'sneakers' | 'apparel' | 'accessories' | 'other') || 'other'}
              className="min-w-[220px]"
            />
          )
        },
        enableSorting: false,
      }),

      // Date column
      columnHelper.accessor('date', {
        id: 'date',
        header: 'Date',
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
            <span className="text-muted">-</span>
          )
        },
        enableSorting: true,
      }),

      // Amount column
      columnHelper.accessor('amount', {
        id: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: (info) => {
          const row = info.row.original
          const value = info.getValue()
          const converted = convert(Math.abs(value), 'GBP')
          const isBuy = row.type === 'BUY'

          return (
            <div
              className="text-right mono font-medium"
              style={{ color: isBuy ? '#F87171' : '#00FF94' }}
            >
              {isBuy ? '-' : '+'}{format(converted)}
            </div>
          )
        },
        enableSorting: true,
      }),

      // Profit column (SELL only)
      columnHelper.accessor('profit', {
        id: 'profit',
        header: () => (
          <div className="text-right flex items-center justify-end gap-1">
            Profit
            <Info className="h-3 w-3 text-muted" />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original
          const value = info.getValue()

          // BUY rows don't have profit
          if (row.type === 'BUY') {
            return <div className="text-right text-muted">-</div>
          }

          const converted = convert(value || 0, 'GBP')
          const isPositive = (value || 0) >= 0

          return (
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div
                    className="text-right mono text-[15px] font-bold cursor-help"
                    style={{ color: isPositive ? '#00FF94' : '#F87171' }}
                  >
                    {isPositive ? '+' : ''}{format(converted)}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="bg-elev-1 border-border p-3"
                >
                  <AmountTooltipContent row={row} />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        enableSorting: true,
      }),

      // Platform column
      columnHelper.accessor('platform', {
        id: 'platform',
        header: 'Platform',
        cell: (info) => {
          const row = info.row.original
          const platform = info.getValue()

          // BUY rows don't have platform
          if (row.type === 'BUY') {
            return <span className="text-muted">-</span>
          }

          const platformLower = platform?.toLowerCase()

          const getPlatformBadge = () => {
            switch (platformLower) {
              case 'stockx':
                return { label: 'StockX', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' }
              case 'alias':
              case 'goat':
                return { label: 'Alias', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }
              case 'ebay':
                return { label: 'eBay', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' }
              case 'private':
                return { label: 'Private', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' }
              default:
                return { label: platform || 'Other', bg: 'bg-muted/10', text: 'text-muted', border: 'border-border' }
            }
          }

          if (!platform) {
            return <span className="text-muted">-</span>
          }

          const badge = getPlatformBadge()

          return (
            <span className={cn(
              "inline-flex px-2 py-0.5 rounded text-xs font-medium border",
              badge.bg, badge.text, badge.border
            )}>
              {badge.label}
            </span>
          )
        },
        enableSorting: false,
      }),

      // Status column
      columnHelper.accessor('item_status', {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue()
          if (!status) return <span className="text-muted">-</span>

          const statusLower = status.toLowerCase()

          const getStatusStyle = () => {
            switch (statusLower) {
              case 'sold':
                return 'text-emerald-400'
              case 'in_stock':
                return 'text-blue-400'
              case 'consigned':
                return 'text-purple-400'
              case 'listed':
                return 'text-amber-400'
              default:
                return 'text-muted'
            }
          }

          const getStatusLabel = () => {
            switch (statusLower) {
              case 'in_stock':
                return 'In Stock'
              case 'sold':
                return 'Sold'
              default:
                return status.charAt(0).toUpperCase() + status.slice(1)
            }
          }

          return (
            <span className={cn("text-xs font-medium", getStatusStyle())}>
              {getStatusLabel()}
            </span>
          )
        },
        enableSorting: false,
      }),
    ],
    [convert, format, copiedSku]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  })

  // Loading state
  if (loading) {
    return (
      <TableBase>
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className="h-4 w-12" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i} index={i}>
              <TableCell><Skeleton className="h-6 w-16" /></TableCell>
              <TableCell><Skeleton className="h-12 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableBase>
    )
  }

  // Empty state (handled by parent)
  if (rows.length === 0) {
    return null
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
                      header.column.getCanSort() && 'hover:text-fg transition-colors'
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
