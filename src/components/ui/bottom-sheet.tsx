/**
 * Bottom Sheet Component
 * Mobile-optimized drawer that slides up from the bottom
 */

'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  className?: string
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  className,
}: BottomSheetProps) {
  React.useEffect(() => {
    if (open) {
      // Prevent scroll on body when sheet is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'max-h-[85vh] rounded-t-2xl',
          'bg-elev-1 border-t-2 border-l-2 border-r-2 border-[#00FF94]/20',
          'shadow-2xl',
          'animate-in slide-in-from-bottom-full duration-300',
          className
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-elev-1 rounded-t-2xl">
          {title && (
            <h3 className="text-lg font-semibold text-fg">{title}</h3>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="ml-auto p-2 hover:bg-elev-2 rounded-lg transition-all"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-60px)] overscroll-contain">
          {children}
        </div>
      </div>
    </>
  )
}
