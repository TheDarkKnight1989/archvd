'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Save, Trash2, MoreVertical } from 'lucide-react'

export interface SavedViewChipProps {
  label: string
  active?: boolean
  onApply: () => void
  onSave?: () => void
  onDelete?: () => void
}

export function SavedViewChip({
  label,
  active = false,
  onApply,
  onSave,
  onDelete,
}: SavedViewChipProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const hasActions = onSave || onDelete

  return (
    <div className="inline-flex items-center gap-0.5">
      <Button
        onClick={onApply}
        variant="outline"
        size="sm"
        className={cn(
          'h-8 px-3 rounded-full text-xs font-medium transition-all duration-120',
          active
            ? 'bg-accent-200 text-black border-accent hover:bg-accent-300'
            : 'bg-elev-1 border-border hover:border-accent/60'
        )}
        title={label}
        aria-label={`Apply ${label} view`}
      >
        <span className="max-w-[120px] truncate">{label}</span>
      </Button>

      {hasActions && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-elev-2 transition-all duration-120"
              aria-label={`${label} view options`}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[160px] bg-elev-3 border-border p-1.5"
            align="start"
          >
            <div className="space-y-0.5">
              {onSave && (
                <button
                  onClick={() => {
                    onSave()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-2 transition-all duration-120"
                >
                  <Save className="h-4 w-4" />
                  Save changes
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all duration-120"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
