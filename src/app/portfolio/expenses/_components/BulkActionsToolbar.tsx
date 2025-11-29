/**
 * Bulk Actions Toolbar Component
 * Multi-select and batch operations for expenses
 */

'use client'

import { Trash2, Tag, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface BulkActionsToolbarProps {
  selectedCount: number
  onDeleteSelected: () => void
  onTagSelected: () => void
  onExportSelected: () => void
  onClearSelection: () => void
  className?: string
}

export function BulkActionsToolbar({
  selectedCount,
  onDeleteSelected,
  onTagSelected,
  onExportSelected,
  onClearSelection,
  className,
}: BulkActionsToolbarProps) {
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
          {selectedCount} {selectedCount === 1 ? 'expense' : 'expenses'} selected
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button
          onClick={onTagSelected}
          size="sm"
          variant="outline"
          className="border-border hover:bg-accent/10 hover:border-accent/40"
        >
          <Tag className="h-4 w-4 mr-2" />
          Add Tags
        </Button>

        <Button
          onClick={onExportSelected}
          size="sm"
          variant="outline"
          className="border-border hover:bg-accent/10 hover:border-accent/40"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export
        </Button>

        <Button
          onClick={onDeleteSelected}
          size="sm"
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
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
