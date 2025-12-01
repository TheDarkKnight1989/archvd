'use client'

import { useState } from 'react'
import { X, Download, TrendingUp, PauseCircle, PlayCircle, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

interface MobileBulkBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkList?: () => void
  onBulkPause?: () => void
  onBulkActivate?: () => void
  onBulkReprice?: () => void
  onBulkDelete?: () => void
  onBulkExport?: () => void
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
}: MobileBulkBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-bg via-bg to-bg/95 backdrop-blur-lg border-t border-[#00FF94]/20',
        'shadow-[0_-4px_20px_rgba(0,255,148,0.15)] animate-in slide-in-from-bottom-4 duration-200'
      )}
    >
      <div className="max-w-[1600px] mx-auto">
        {/* Selection Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-fg">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="p-1 hover:bg-elev-2 rounded-md transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-muted" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Export */}
          {onBulkExport && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBulkExport}
              className="flex-shrink-0 border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          )}

          {/* List on StockX */}
          {onBulkList && (
            <Button
              size="sm"
              onClick={onBulkList}
              className="flex-shrink-0 bg-[#00FF94] hover:bg-[#00E085] text-black text-xs font-semibold"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              List
            </Button>
          )}

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 border-border text-fg hover:bg-elev-2 text-xs"
              >
                <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[180px] bg-[#0E1A15] border-[#15251B] p-2 shadow-xl"
              align="end"
              side="top"
            >
              {onBulkReprice && (
                <DropdownMenuItem
                  onClick={onBulkReprice}
                  className="text-purple-400 hover:bg-purple-500/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Reprice
                </DropdownMenuItem>
              )}

              {onBulkActivate && (
                <DropdownMenuItem
                  onClick={onBulkActivate}
                  className="text-emerald-400 hover:bg-emerald-500/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Activate
                </DropdownMenuItem>
              )}

              {onBulkPause && (
                <DropdownMenuItem
                  onClick={onBulkPause}
                  className="text-yellow-400 hover:bg-yellow-500/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <PauseCircle className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}

              {onBulkDelete && (
                <>
                  <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />
                  <DropdownMenuItem
                    onClick={onBulkDelete}
                    className="text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
