'use client'

import { TrendingUp, PauseCircle, PlayCircle, Trash2, Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils/cn'

interface BulkActionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  platform: 'stockx' | 'alias'
  onBulkList: () => void
  onBulkPause: () => void
  onBulkActivate: () => void
  onBulkReprice: () => void
  onBulkAddToSellList: () => void
  onBulkDelete: () => void
}

export function BulkActionsSheet({
  open,
  onOpenChange,
  selectedCount,
  platform,
  onBulkList,
  onBulkPause,
  onBulkActivate,
  onBulkReprice,
  onBulkAddToSellList,
  onBulkDelete,
}: BulkActionsSheetProps) {
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
          <SheetTitle className="text-left text-base font-semibold text-fg">
            Bulk Actions
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-muted">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-2">
          {/* StockX-specific actions */}
          {platform === 'stockx' && (
            <>
              {/* List on StockX */}
              <button
                onClick={() => handleAction(onBulkList)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-[#00FF94]/10 hover:bg-[#00FF94]/20 transition-colors border border-[#00FF94]/30"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#00FF94]/20">
                  <TrendingUp className="h-5 w-5 text-[#00FF94]" />
                </div>
                <span className="text-base font-semibold text-[#00FF94]">List on StockX</span>
              </button>

              {/* Activate */}
              <button
                onClick={() => handleAction(onBulkActivate)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                  <PlayCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="text-base font-medium text-fg">Activate on StockX</span>
              </button>

              {/* Pause */}
              <button
                onClick={() => handleAction(onBulkPause)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10">
                  <PauseCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <span className="text-base font-medium text-fg">Pause on StockX</span>
              </button>

              {/* Reprice */}
              <button
                onClick={() => handleAction(onBulkReprice)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <span className="text-base font-medium text-fg">Reprice on StockX</span>
              </button>
            </>
          )}

          {/* Add to Sell List */}
          <button
            onClick={() => handleAction(onBulkAddToSellList)}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
              <Plus className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-base font-medium text-fg">Add to Sell List</span>
          </button>

          {/* Delete */}
          <div className="my-2 border-t border-[#15251B]" />
          <button
            onClick={() => handleAction(onBulkDelete)}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-left hover:bg-red-500/5 transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <span className="text-base font-medium text-red-400">Delete</span>
          </button>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-8" />
      </SheetContent>
    </Sheet>
  )
}
