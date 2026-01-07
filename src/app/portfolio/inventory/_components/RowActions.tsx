'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { BottomSheet } from '@/components/ui/bottom-sheet'
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
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { InventoryV4Listing } from '@/lib/inventory-v4/types'

export interface RowActionsProps {
  status: string
  // Item actions
  onEdit: () => void
  onDuplicate?: () => void
  onAdjustTaxRate?: () => void
  onDelete?: () => void
  // StockX actions (V4: prefer stockxListing, V3: fall back to stockxListingStatus)
  stockxMapped?: boolean
  /** V4: The StockX listing from item.listings (source of truth) */
  stockxListing?: InventoryV4Listing | null
  /** @deprecated V3 legacy - use stockxListing instead */
  stockxListingStatus?: string | null
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onDeactivateListing?: () => void
  onReactivateListing?: () => void
  onDeleteListing?: () => void
  onPrintStockXLabel?: () => void
  // Alias actions
  aliasListingStatus?: string | null
  onAttachAliasProduct?: () => void
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
  stockxListing,
  stockxListingStatus, // Legacy V3 fallback
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onPrintStockXLabel,
  // Alias actions
  aliasListingStatus,
  onAttachAliasProduct,
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
  const isMobile = useMediaQuery('(max-width: 768px)')

  const isSold = status === 'sold'

  // =========================================================================
  // V4 LISTING STATE (source of truth when available)
  // =========================================================================
  // Prefer V4 stockxListing over legacy stockxListingStatus
  // V4 listing status: 'active' | 'paused' | 'sold' | 'expired' | 'cancelled'
  // V3 listing status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'CANCELLED' (uppercase)

  const hasV4Listing = !!stockxListing

  // Active/paused = can reprice, deactivate, delete
  const hasActiveOrPausedListing = hasV4Listing
    ? stockxListing.status === 'active' || stockxListing.status === 'paused'
    : stockxListingStatus === 'ACTIVE' || stockxListingStatus === 'PENDING'

  // Paused specifically = can reactivate
  const hasPausedListing = hasV4Listing
    ? stockxListing.status === 'paused'
    : stockxListingStatus === 'INACTIVE'

  // Active specifically = can pause
  const hasActiveListing = hasV4Listing
    ? stockxListing.status === 'active'
    : stockxListingStatus === 'ACTIVE' || stockxListingStatus === 'PENDING'

  // Can reprice only if we have a valid external_listing_id
  const canRepriceListing = hasActiveOrPausedListing && (
    hasV4Listing ? !!stockxListing.external_listing_id : true
  )

  // Can list = mapped + no active/paused listing + not sold
  const canListOnStockX = stockxMapped && !hasActiveOrPausedListing && !isSold

  // Show StockX section if any action is possible
  const showStockXSection = canListOnStockX || hasActiveOrPausedListing || hasPausedListing

  const hasAliasListing = !!aliasListingStatus

  const handleAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  // Shared menu content - used by both Popover and BottomSheet
  const menuContent = (
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
          {showStockXSection && (
            <>
              <div className="border-t border-[#15251B] my-1" />
              <div className="px-2 py-1.5">
                <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">StockX</span>
              </div>

              {/* Place Listing - only when no active/paused listing exists */}
              {canListOnStockX && onListOnStockX && (
                <button
                  onClick={() => handleAction(onListOnStockX)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#00FF94] hover:bg-[#00FF94]/10 transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Place Listing
                </button>
              )}

              {/* Edit/Reprice - only when we have external_listing_id */}
              {canRepriceListing && onRepriceListing && (
                <button
                  onClick={() => handleAction(onRepriceListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <TrendingUp className="h-4 w-4" />
                  Edit Listing
                </button>
              )}

              {/* Pause - only when listing is currently active */}
              {hasActiveListing && onDeactivateListing && (
                <button
                  onClick={() => handleAction(onDeactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-yellow-400 hover:bg-yellow-500/10 transition-all duration-120"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause Listing
                </button>
              )}

              {/* Print Label - when active or paused */}
              {hasActiveOrPausedListing && onPrintStockXLabel && (
                <button
                  onClick={() => handleAction(onPrintStockXLabel)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <Printer className="h-4 w-4" />
                  Print Label
                </button>
              )}

              {/* Reactivate - only when listing is paused */}
              {hasPausedListing && onReactivateListing && (
                <button
                  onClick={() => handleAction(onReactivateListing)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <PlayCircle className="h-4 w-4" />
                  Reactivate
                </button>
              )}

              {/* Delete Listing - when active or paused */}
              {hasActiveOrPausedListing && onDeleteListing && (
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
          {(onAttachAliasProduct || onPlaceAliasListing || hasAliasListing) && (
            <>
              <div className="border-t border-[#15251B] my-1" />
              <div className="px-2 py-1.5">
                <span className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide">Alias</span>
              </div>

              {onAttachAliasProduct && (
                <button
                  onClick={() => handleAction(onAttachAliasProduct)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#E8F6EE] hover:bg-[#0B1510] transition-all duration-120"
                >
                  <Plus className="h-4 w-4" />
                  Attach Alias product
                </button>
              )}

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
  )

  // Trigger button - shared by both mobile and desktop
  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 hover:bg-elev-2 transition-all duration-120"
      aria-label="Row actions"
      onClick={() => setOpen(true)}
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  )

  // Mobile: Use BottomSheet for better touch experience
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title="Actions"
        >
          <div className="p-2">
            {menuContent}
          </div>
        </BottomSheet>
      </>
    )
  }

  // Desktop: Use Popover with collision detection
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] max-h-[min(400px,calc(var(--radix-popover-content-available-height)-16px))] overflow-y-auto bg-[#0E1A15] border-[#15251B] p-2 shadow-xl"
        align="end"
        sideOffset={8}
        collisionPadding={20}
      >
        {menuContent}
      </PopoverContent>
    </Popover>
  )
}
