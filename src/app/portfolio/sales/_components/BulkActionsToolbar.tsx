/**
 * Bulk Actions Toolbar
 * Appears when items are selected in the sales table
 */

'use client'

import { Download, Tag, Trash2, X, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface BulkActionsToolbarProps {
  selectedCount: number
  selectedItems: SalesItem[]
  onClearSelection: () => void
  onBulkExport: () => void
  onBulkTag?: () => void
  onBulkDelete?: () => void
  className?: string
}

export function BulkActionsToolbar({
  selectedCount,
  selectedItems,
  onClearSelection,
  onBulkExport,
  onBulkTag,
  onBulkDelete,
  className,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-gradient-to-r from-[#0E1A15] to-[#0E1A15]/95',
        'border-2 border-[#00FF94]/40 rounded-2xl shadow-2xl',
        'px-5 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 fade-in-0 duration-300',
        className
      )}
    >
      {/* Selection Info */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-[#00FF94]/20 flex items-center justify-center">
          <span className="text-sm font-bold text-[#00FF94] mono">{selectedCount}</span>
        </div>
        <span className="text-sm font-semibold text-fg">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border/40" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBulkExport}
          className="h-8 text-xs border border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export
        </Button>

        {onBulkTag && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBulkTag}
            className="h-8 text-xs border border-border/30 text-fg hover:bg-elev-1"
          >
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            Tag
          </Button>
        )}

        {onBulkDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBulkDelete}
            className="h-8 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border/40" />

      {/* Clear Selection */}
      <button
        onClick={onClearSelection}
        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-elev-1 transition-all text-muted hover:text-fg"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
