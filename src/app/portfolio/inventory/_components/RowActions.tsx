'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { MoreVertical, Edit, CheckCircle, XCircle, Receipt, Plus, TrendingUp, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface RowActionsProps {
  status: string
  onEdit: () => void
  onToggleSold: () => void
  onAddExpense: () => void
  onAddToWatchlist?: () => void
  onDelete?: () => void
  // StockX listing actions
  stockxMapped?: boolean
  stockxListingStatus?: string | null
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onDeactivateListing?: () => void
  onReactivateListing?: () => void
  onDeleteListing?: () => void
}

export function RowActions({
  status,
  onEdit,
  onToggleSold,
  onAddExpense,
  onAddToWatchlist,
  onDelete,
  stockxMapped,
  stockxListingStatus,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
}: RowActionsProps) {
  const [open, setOpen] = useState(false)

  const isSold = status === 'sold'
  const canListOnStockX = stockxMapped && !stockxListingStatus && !isSold
  const hasActiveListing = stockxListingStatus === 'ACTIVE'
  const hasInactiveListing = stockxListingStatus === 'INACTIVE'

  const handleAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-elev-2 transition-all duration-120"
          aria-label="Row actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] bg-elev-3 border-border p-1.5"
        align="end"
      >
        <div className="space-y-0.5">
          <button
            onClick={() => handleAction(onEdit)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>

          {onAddToWatchlist && (
            <button
              onClick={() => handleAction(onAddToWatchlist)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
            >
              <Plus className="h-4 w-4" />
              Add to Watchlist
            </button>
          )}

          <button
            onClick={() => handleAction(onToggleSold)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-120',
              isSold
                ? 'text-fg hover:bg-elev-2'
                : 'text-green-400 hover:bg-green-500/10'
            )}
          >
            {isSold ? (
              <>
                <XCircle className="h-4 w-4" />
                Mark as In Stock
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Mark as Sold
              </>
            )}
          </button>

          <button
            onClick={() => handleAction(onAddExpense)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
          >
            <Receipt className="h-4 w-4" />
            Add Expense
          </button>

          {/* StockX Actions */}
          {(canListOnStockX || hasActiveListing || hasInactiveListing) && (
            <>
              <div className="border-t border-border my-1" />

              {canListOnStockX && onListOnStockX && (
                <button
                  onClick={() => handleAction(onListOnStockX)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  List on StockX
                </button>
              )}

              {hasActiveListing && onRepriceListing && (
                <button
                  onClick={() => handleAction(onRepriceListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Reprice
                </button>
              )}

              {hasActiveListing && onDeactivateListing && (
                <button
                  onClick={() => handleAction(onDeactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
                >
                  <PauseCircle className="h-4 w-4" />
                  Deactivate
                </button>
              )}

              {hasInactiveListing && onReactivateListing && (
                <button
                  onClick={() => handleAction(onReactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
                >
                  <PlayCircle className="h-4 w-4" />
                  Reactivate
                </button>
              )}

              {(hasActiveListing || hasInactiveListing) && onDeleteListing && (
                <button
                  onClick={() => handleAction(onDeleteListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-120"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Listing
                </button>
              )}
            </>
          )}

          {/* Delete Item */}
          {onDelete && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => handleAction(onDelete)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-120"
              >
                <Trash2 className="h-4 w-4" />
                Delete Item
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
