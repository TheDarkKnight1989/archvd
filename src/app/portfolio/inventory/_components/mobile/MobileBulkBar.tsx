'use client'

import { useState } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { MobileBulkActionsSheet } from './MobileBulkActionsSheet'

interface MobileBulkBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkList?: () => void
  onBulkPause?: () => void
  onBulkActivate?: () => void
  onBulkReprice?: () => void
  onBulkDelete?: () => void
  onBulkExport?: () => void
  onAddToSellList?: () => void
}

export function MobileBulkBar({
  selectedCount,
  onClearSelection,
  onBulkList,
  onBulkPause,
  onBulkActivate,
  onBulkReprice,
  onBulkDelete,
  onBulkExport,
  onAddToSellList,
}: MobileBulkBarProps) {
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-bg via-bg to-bg/95 backdrop-blur-lg border-t-2 border-[#00FF94]/20',
          'shadow-[0_-4px_20px_rgba(0,255,148,0.15)] animate-in slide-in-from-bottom-4 duration-200'
        )}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
          {/* Selection Info */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold text-fg">
              {selectedCount}
            </span>
            <button
              onClick={onClearSelection}
              className="p-1.5 hover:bg-elev-2 rounded-md transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>

          {/* Actions Button */}
          <Button
            onClick={() => setActionsSheetOpen(true)}
            className="flex-1 bg-[#00FF94] hover:bg-[#00E085] text-black font-semibold shadow-lg"
            size="default"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Actions
            <Badge className="ml-2 bg-black/20 text-[#00FF94] border-0">
              {selectedCount}
            </Badge>
          </Button>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-2" />
      </div>

      {/* Bulk Actions Sheet */}
      <MobileBulkActionsSheet
        open={actionsSheetOpen}
        onOpenChange={setActionsSheetOpen}
        selectedCount={selectedCount}
        onBulkList={onBulkList}
        onBulkPause={onBulkPause}
        onBulkActivate={onBulkActivate}
        onBulkReprice={onBulkReprice}
        onBulkDelete={onBulkDelete}
        onBulkExport={onBulkExport}
        onAddToSellList={onAddToSellList}
      />
    </>
  )
}
