/**
 * Bulk StockX Actions Toolbar
 * Floating toolbar for bulk pause/activate/reprice operations on StockX listings
 */

'use client'

import { PauseCircle, PlayCircle, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface BulkStockxActionsToolbarProps {
  selectedCount: number
  onPauseListings: () => void
  onActivateListings: () => void
  onRepriceListings: () => void
  onClearSelection: () => void
  className?: string
}

export function BulkStockxActionsToolbar({
  selectedCount,
  onPauseListings,
  onActivateListings,
  onRepriceListings,
  onClearSelection,
  className,
}: BulkStockxActionsToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
      'bg-elev-1 border border-border rounded-2xl shadow-2xl',
      'px-6 py-4 flex items-center gap-4',
      'animate-in slide-in-from-bottom-4',
      className
    )}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm font-semibold text-fg">
          {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button
          onClick={onPauseListings}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/50"
        >
          <PauseCircle className="h-4 w-4 mr-2" />
          Pause on StockX
        </Button>

        <Button
          onClick={onActivateListings}
          size="sm"
          variant="outline"
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
        >
          <PlayCircle className="h-4 w-4 mr-2" />
          Activate on StockX
        </Button>

        <Button
          onClick={onRepriceListings}
          size="sm"
          variant="outline"
          className="border-border hover:bg-accent/10 hover:border-accent/40"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Reprice on StockX
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      <button
        onClick={onClearSelection}
        className="p-1.5 hover:bg-elev-2 rounded-lg transition-colors"
        title="Clear selection"
      >
        <X className="h-4 w-4 text-dim" />
      </button>
    </div>
  )
}
