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
import { MoreHorizontal, Copy, Edit, Undo2, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EditSaleModal } from '@/components/modals/EditSaleModal'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import { TableBase, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/TableBase'
import type { SalesItem } from '@/hooks/useSalesTable'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const columnHelper = createColumnHelper<SalesItem>()

export interface SalesTableProps {
  items: SalesItem[]
  loading: boolean
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  onRefresh?: () => void
}

export function SalesTable({
  items,
  loading,
  sorting,
  onSortingChange,
  onRefresh,
}: SalesTableProps) {
  const { convert, format, currency } = useCurrency()
  const [copiedSku, setCopiedSku] = useState<string | null>(null)
  const [editingSale, setEditingSale] = useState<SalesItem | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Copy SKU to clipboard
  const handleCopySku = async (sku: string) => {
    await navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    setTimeout(() => setCopiedSku(null), 2000)
  }

  // Open edit modal
  const handleEditSale = (sale: SalesItem) => {
    setEditingSale(sale)
    setEditModalOpen(true)
  }

  // Save sale edits
  const handleSaveSale = async (updates: Partial<SalesItem>) => {
    if (!editingSale?.id) return

    try {
      const response = await fetch(`/api/sales/${editingSale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update sale')
      }

      if (onRefresh) {
        onRefresh()
      }

      setEditModalOpen(false)
      setEditingSale(null)
    } catch (error) {
      console.error('[SalesTable] Error updating sale:', error)
      throw error
    }
  }

  // Undo sale - restore item to inventory
  const handleUndoSale = async (saleId: string) => {
    if (!confirm('Move this item back to inventory? The sale record will be deleted.')) {
      return
    }

    try {
      const response = await fetch(`/api/sales/${saleId}/undo`, {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || 'Failed to undo sale')
        return
      }

      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('[SalesTable] Error undoing sale:', error)
      alert('Failed to undo sale')
    }
  }

  // Realised Gain/Loss tooltip breakdown
  const GainLossTooltipContent = ({ item }: { item: SalesItem }) => {
    const salePrice = item.sold_price || 0
    const fees = item.sales_fee || 0
    const purchasePrice = item.purchase_price || 0
    const realisedGain = item.margin_gbp || 0

    return (
      <div className="text-xs space-y-1.5 min-w-[160px]">
        <div className="flex justify-between">
          <span className="text-muted">Sale Price</span>
          <span className="mono">{format(convert(salePrice, 'GBP'))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Fees</span>
          <span className="mono text-red-400">−{format(convert(fees, 'GBP'))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Purchase Price</span>
          <span className="mono text-red-400">−{format(convert(purchasePrice, 'GBP'))}</span>
        </div>
        <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
          <span>{realisedGain >= 0 ? 'Realised Gain' : 'Realised Loss'}</span>
          <span className={cn(
            "mono",
            realisedGain >= 0 ? "text-accent" : "text-red-400"
          )}>
            {realisedGain >= 0 ? '+' : ''}{format(convert(realisedGain, 'GBP'))}
          </span>
        </div>
      </div>
    )
  }

  // Define columns: Item, Purchase Price, Sale Price, Realised Gain/Loss, Date Sold, Platform, Actions
  const columns = useMemo(
    () => [
      // Item column
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
              category={(item.category?.toLowerCase() as 'sneakers' | 'apparel' | 'accessories' | 'other') || 'other'}
              className="min-w-[260px]"
            />
          )
        },
        enableSorting: false,
      }),

      // Purchase Price column
      columnHelper.accessor('purchase_price', {
        id: 'purchase_price',
        header: () => <div className="text-right">Purchase Price</div>,
        cell: (info) => {
          const value = info.getValue()
          if (!value) return <span className="text-muted text-right block">—</span>
          const converted = convert(value, 'GBP')
          return (
            <div className="text-right mono text-fg">
              {format(converted)}
            </div>
          )
        },
        enableSorting: true,
      }),

      // Sale Price column
      columnHelper.accessor('sold_price', {
        id: 'sold_price',
        header: () => <div className="text-right">Sale Price</div>,
        cell: (info) => {
          const value = info.getValue()
          const converted = convert(value || 0, 'GBP')
          return (
            <div className="text-right mono font-medium text-fg">
              {format(converted)}
            </div>
          )
        },
        enableSorting: true,
      }),

      // Realised Gain/Loss column with tooltip
      columnHelper.accessor('margin_gbp', {
        id: 'margin_gbp',
        header: () => (
          <div className="text-right flex items-center justify-end gap-1">
            Realised Gain/Loss
            <Info className="h-3 w-3 text-muted" />
          </div>
        ),
        cell: (info) => {
          const item = info.row.original
          const value = info.getValue()
          const converted = convert(value || 0, 'GBP')
          const isPositive = (value || 0) >= 0

          return (
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "text-right mono text-[15px] font-bold cursor-help",
                    isPositive ? "text-accent" : "text-red-400"
                  )}>
                    {isPositive ? '+' : ''}{format(converted)}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="bg-elev-1 border-border p-3"
                >
                  <GainLossTooltipContent item={item} />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        enableSorting: true,
      }),

      // Date Sold column
      columnHelper.accessor('sold_date', {
        id: 'sold_date',
        header: 'Date Sold',
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
            <span className="text-muted">—</span>
          )
        },
        enableSorting: true,
      }),

      // Platform column
      columnHelper.accessor('platform', {
        id: 'platform',
        header: 'Platform',
        cell: (info) => {
          const platform = info.getValue()
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
            return <span className="text-muted">—</span>
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

      // Actions column
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const item = info.row.original
          const [open, setOpen] = useState(false)

          const handleAction = (action: () => void) => {
            action()
            setOpen(false)
          }

          return (
            <div className="flex justify-end">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="h-8 w-8 p-0 hover:bg-elev-2 rounded-md transition-colors flex items-center justify-center"
                    aria-label="Row actions"
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[180px] bg-elev-1 border-border p-1.5"
                  align="end"
                >
                  <button
                    onClick={() => handleAction(() => handleEditSale(item))}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg hover:bg-elev-2 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleAction(() => handleCopySku(item.sku))}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg hover:bg-elev-2 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedSku === item.sku ? 'Copied!' : 'Copy SKU'}
                  </button>

                  <div className="my-1 border-t border-border" />

                  <button
                    onClick={() => handleAction(() => handleUndoSale(item.id))}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-amber-400 hover:bg-elev-2 transition-colors"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo Sale
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          )
        },
        enableSorting: false,
      }),
    ],
    [convert, format, currency, copiedSku]
  )

  const table = useReactTable({
    data: items,
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
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-24" /></TableHead>
            <TableHead><Skeleton className="h-4 w-20" /></TableHead>
            <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            <TableHead><Skeleton className="h-4 w-8" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i} index={i}>
              <TableCell><Skeleton className="h-12 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableBase>
    )
  }

  // Empty state (handled by parent)
  if (items.length === 0) {
    return null
  }

  return (
    <>
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

      {/* Edit Sale Modal */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false)
            setEditingSale(null)
          }}
          onSave={handleSaveSale}
        />
      )}
    </>
  )
}
