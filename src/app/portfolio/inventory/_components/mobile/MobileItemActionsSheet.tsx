'use client'

import { Edit, TrendingUp, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils/cn'

interface MobileItemActionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  status: 'Listed' | 'Paused' | 'Unlisted'
  canListOnStockX: boolean
  onViewMarket: () => void
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onPauseListing?: () => void
  onActivateListing?: () => void
  onDeleteItem?: () => void
}

export function MobileItemActionsSheet({
  open,
  onOpenChange,
  itemName,
  status,
  canListOnStockX,
  onViewMarket,
  onListOnStockX,
  onRepriceListing,
  onPauseListing,
  onActivateListing,
  onDeleteItem,
}: MobileItemActionsSheetProps) {
  const handleAction = (action: () => void) => {
    action()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-[#0E1A15] border-t-2 border-[#00FF94]/20 rounded-t-2xl p-0"
      >
        <SheetHeader className="p-4 border-b border-[#15251B]">
          <SheetTitle className="text-left text-base font-semibold text-fg line-clamp-1">
            {itemName}
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-2">
          {/* View Market */}
          <button
            onClick={() => handleAction(onViewMarket)}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#00FF94]/10">
              <TrendingUp className="h-5 w-5 text-[#00FF94]" />
            </div>
            <span className="text-base font-medium text-fg">View Market</span>
          </button>

          {/* List on StockX - if unlisted and can list */}
          {status === 'Unlisted' && canListOnStockX && onListOnStockX && (
            <button
              onClick={() => handleAction(onListOnStockX)}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-[#00FF94]/10 hover:bg-[#00FF94]/20 transition-colors border border-[#00FF94]/30"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#00FF94]/20">
                <TrendingUp className="h-5 w-5 text-[#00FF94]" />
              </div>
              <span className="text-base font-semibold text-[#00FF94]">List on StockX</span>
            </button>
          )}

          {/* Reprice - if listed or paused */}
          {(status === 'Listed' || status === 'Paused') && onRepriceListing && (
            <button
              onClick={() => handleAction(onRepriceListing)}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-base font-medium text-fg">Reprice on StockX</span>
            </button>
          )}

          {/* Pause - if listed */}
          {status === 'Listed' && onPauseListing && (
            <button
              onClick={() => handleAction(onPauseListing)}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10">
                <PauseCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <span className="text-base font-medium text-fg">Pause on StockX</span>
            </button>
          )}

          {/* Activate - if paused */}
          {status === 'Paused' && onActivateListing && (
            <button
              onClick={() => handleAction(onActivateListing)}
              className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                <PlayCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-base font-medium text-fg">Activate on StockX</span>
            </button>
          )}

          {/* Delete */}
          {onDeleteItem && (
            <>
              <div className="my-3 border-t border-[#15251B]" />
              <button
                onClick={() => handleAction(onDeleteItem)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/20"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <span className="text-base font-medium text-red-400">Delete Item</span>
              </button>
            </>
          )}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-8" />
      </SheetContent>
    </Sheet>
  )
}
