'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  MoreVertical,
  Edit,
  Copy,
  DollarSign,
  Trash2,
  TrendingUp,
  PauseCircle,
  PlayCircle,
  Printer,
  Plus,
  ListPlus,
  Tag,
  CheckCircle,
  XCircle,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface RowActionsProps {
  status: string
  // Item actions
  onEdit: () => void
  onDuplicate?: () => void
  onAdjustTaxRate?: () => void
  onDelete?: () => void
  // StockX actions
  stockxMapped?: boolean
  stockxListingStatus?: string | null
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onDeactivateListing?: () => void
  onReactivateListing?: () => void
  onDeleteListing?: () => void
  onPrintStockXLabel?: () => void
  // Alias actions
  aliasListingStatus?: string | null
  onPlaceAliasListing?: () => void
  onEditAliasListing?: () => void
  onCancelAliasListing?: () => void
  // Status actions
  onAddToWatchlist?: () => void
  onAddToSellList?: () => void
  onMarkListed?: () => void
  onMarkSold: () => void
  onMarkUnlisted?: () => void
  onTogglePersonals?: () => void
}

export function RowActions({
  status,
  // Item actions
  onEdit,
  onDuplicate,
  onAdjustTaxRate,
  onDelete,
  // StockX actions
  stockxMapped,
  stockxListingStatus,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onPrintStockXLabel,
  // Alias actions
  aliasListingStatus,
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
}: RowActionsProps) {
  const [open, setOpen] = useState(false)

  const isSold = status === 'sold'
  const canListOnStockX = stockxMapped && !stockxListingStatus && !isSold
  const hasActiveStockXListing = stockxListingStatus === 'ACTIVE' || stockxListingStatus === 'PENDING'
  const hasInactiveStockXListing = stockxListingStatus === 'INACTIVE' || stockxListingStatus === 'CANCELLED'
  const hasAliasListing = !!aliasListingStatus

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
        className="w-[200px] bg-[#0E1A15] border-[#15251B] p-2 shadow-xl"
        align="end"
      >
        <div className="space-y-0.5">
          {/* SECTION 1: ITEM ACTIONS */}
          <div className="px-2 py-1.5">
            <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">Item</span>
          </div>

          <button
            onClick={() => handleAction(onEdit)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>

          {onDuplicate && (
            <button
              onClick={() => handleAction(onDuplicate)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
          )}

          {onAdjustTaxRate && (
            <button
              onClick={() => handleAction(onAdjustTaxRate)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <DollarSign className="h-4 w-4" />
              Adjust Tax Rate
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => handleAction(onDelete)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-120"
            >
              <Trash2 className="h-4 w-4" />
              Delete Item
            </button>
          )}

          {/* SECTION 2: STOCKX ACTIONS */}
          {(canListOnStockX || hasActiveStockXListing || hasInactiveStockXListing) && (
            <>
              <div className="border-t border-[#15251B] my-1" />
              <div className="px-2 py-1.5">
                <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">StockX</span>
              </div>

              {canListOnStockX && onListOnStockX && (
                <button
                  onClick={() => handleAction(onListOnStockX)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#00FF94] hover:bg-[#00FF94]/10 transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Place Listing
                </button>
              )}

              {hasActiveStockXListing && onRepriceListing && (
                <button
                  onClick={() => handleAction(onRepriceListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Edit Listing
                </button>
              )}

              {hasActiveStockXListing && onDeactivateListing && (
                <button
                  onClick={() => handleAction(onDeactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <PauseCircle className="h-4 w-4" />
                  Cancel Listing
                </button>
              )}

              {hasActiveStockXListing && onPrintStockXLabel && (
                <button
                  onClick={() => handleAction(onPrintStockXLabel)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <Printer className="h-4 w-4" />
                  Print Label
                </button>
              )}

              {hasInactiveStockXListing && onReactivateListing && (
                <button
                  onClick={() => handleAction(onReactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <PlayCircle className="h-4 w-4" />
                  Reactivate
                </button>
              )}

              {(hasActiveStockXListing || hasInactiveStockXListing) && onDeleteListing && (
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

          {/* SECTION 3: ALIAS ACTIONS */}
          {(onPlaceAliasListing || hasAliasListing) && (
            <>
              <div className="border-t border-[#15251B] my-1" />
              <div className="px-2 py-1.5">
                <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">Alias</span>
              </div>

              {!hasAliasListing && onPlaceAliasListing && (
                <button
                  onClick={() => handleAction(onPlaceAliasListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#00FF94] hover:bg-[#00FF94]/10 transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Place Listing
                </button>
              )}

              {hasAliasListing && onEditAliasListing && (
                <button
                  onClick={() => handleAction(onEditAliasListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <Edit className="h-4 w-4" />
                  Edit Listing
                </button>
              )}

              {hasAliasListing && onCancelAliasListing && (
                <button
                  onClick={() => handleAction(onCancelAliasListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-120"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Listing
                </button>
              )}
            </>
          )}

          {/* SECTION 4: STATUS ACTIONS */}
          <div className="border-t border-[#15251B] my-1" />
          <div className="px-2 py-1.5">
            <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">Status</span>
          </div>

          {onAddToWatchlist && (
            <button
              onClick={() => handleAction(onAddToWatchlist)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <Plus className="h-4 w-4" />
              Add to Watchlist
            </button>
          )}

          {onAddToSellList && (
            <button
              onClick={() => handleAction(onAddToSellList)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <ListPlus className="h-4 w-4" />
              Add to Sell List
            </button>
          )}

          {onMarkListed && (
            <button
              onClick={() => handleAction(onMarkListed)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <Tag className="h-4 w-4" />
              Mark Listed
            </button>
          )}

          <button
            onClick={() => handleAction(onMarkSold)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-120',
              isSold
                ? 'text-[#E8F6EE] hover:bg-[#0B1510]'
                : 'text-[#00FF94] hover:bg-[#00FF94]/10'
            )}
          >
            {isSold ? (
              <>
                <XCircle className="h-4 w-4" />
                Mark In Stock
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Mark Sold
              </>
            )}
          </button>

          {onMarkUnlisted && (
            <button
              onClick={() => handleAction(onMarkUnlisted)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <XCircle className="h-4 w-4" />
              Mark Unlisted
            </button>
          )}

          {onTogglePersonals && (
            <button
              onClick={() => handleAction(onTogglePersonals)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
            >
              <User className="h-4 w-4" />
              Toggle Personals
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
