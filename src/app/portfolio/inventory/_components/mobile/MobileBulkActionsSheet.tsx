'use client'

import { TrendingUp, PauseCircle, PlayCircle, Trash2, Download, ListPlus, MoreHorizontal } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils/cn'

interface MobileBulkActionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onBulkList?: () => void
  onBulkPause?: () => void
  onBulkActivate?: () => void
  onBulkReprice?: () => void
  onBulkDelete?: () => void
  onBulkExport?: () => void
  onAddToSellList?: () => void
}

export function MobileBulkActionsSheet({
  open,
  onOpenChange,
  selectedCount,
  onBulkList,
  onBulkPause,
  onBulkActivate,
  onBulkReprice,
  onBulkDelete,
  onBulkExport,
  onAddToSellList,
}: MobileBulkActionsSheetProps) {
  const handleAction = (action?: () => void) => {
    if (action) {
      action()
      onOpenChange(false)
    }
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
          {/* Primary Actions */}
          <div className="space-y-2">
            {/* List on StockX */}
            {onBulkList && (
              <button
                onClick={() => handleAction(onBulkList)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-[#00FF94]/10 hover:bg-[#00FF94]/20 transition-colors border border-[#00FF94]/30"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#00FF94]/20">
                  <TrendingUp className="h-5 w-5 text-[#00FF94]" />
                </div>
                <span className="text-base font-semibold text-[#00FF94]">List on StockX</span>
              </button>
            )}

            {/* Activate */}
            {onBulkActivate && (
              <button
                onClick={() => handleAction(onBulkActivate)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                  <PlayCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="text-base font-medium text-fg">Activate on StockX</span>
              </button>
            )}

            {/* Pause */}
            {onBulkPause && (
              <button
                onClick={() => handleAction(onBulkPause)}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left bg-elev-1 hover:bg-elev-2 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-500/10">
                  <PauseCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <span className="text-base font-medium text-fg">Pause on StockX</span>
              </button>
            )}
          </div>

          {/* More Actions Section */}
          <div className="pt-3">
            <div className="flex items-center gap-2 px-2 mb-2">
              <MoreHorizontal className="h-4 w-4 text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">More Actions</span>
            </div>

            {/* Reprice */}
            {onBulkReprice && (
              <button
                onClick={() => handleAction(onBulkReprice)}
                className="w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-elev-1 transition-colors"
              >
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <span className="text-sm font-medium text-fg">Reprice</span>
              </button>
            )}

            {/* Add to Sell List */}
            {onAddToSellList && (
              <button
                onClick={() => handleAction(onAddToSellList)}
                className="w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-elev-1 transition-colors"
              >
                <ListPlus className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-medium text-fg">Add to Sell List</span>
              </button>
            )}

            {/* Export */}
            {onBulkExport && (
              <button
                onClick={() => handleAction(onBulkExport)}
                className="w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-elev-1 transition-colors"
              >
                <Download className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-medium text-fg">Export</span>
              </button>
            )}

            {/* Delete */}
            {onBulkDelete && (
              <>
                <div className="my-2 border-t border-[#15251B]" />
                <button
                  onClick={() => handleAction(onBulkDelete)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg text-left hover:bg-red-500/5 transition-colors"
                >
                  <Trash2 className="h-5 w-5 text-red-400" />
                  <span className="text-sm font-medium text-red-400">Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-8" />
      </SheetContent>
    </Sheet>
  )
}
