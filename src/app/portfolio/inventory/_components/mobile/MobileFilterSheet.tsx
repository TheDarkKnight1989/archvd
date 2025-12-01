'use client'

import { useState } from 'react'
import { X, Check, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils/cn'

interface MobileFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Status filters
  selectedStatus: string[]
  onStatusChange: (status: string[]) => void
  statusOptions: Array<{ key: string; label: string; count: number }>
  // Category filters
  selectedCategory: string[]
  onCategoryChange: (category: string[]) => void
  categoryOptions: Array<{ key: string; label: string; count: number }>
  // Quick filters
  quickFilter: string | null
  onQuickFilterChange: (filter: string | null) => void
  quickFilterOptions: Array<{ key: string; label: string; color: string }>
  // Actions
  onClearAll: () => void
}

export function MobileFilterSheet({
  open,
  onOpenChange,
  selectedStatus,
  onStatusChange,
  statusOptions,
  selectedCategory,
  onCategoryChange,
  categoryOptions,
  quickFilter,
  onQuickFilterChange,
  quickFilterOptions,
  onClearAll,
}: MobileFilterSheetProps) {
  const [localStatus, setLocalStatus] = useState<string[]>(selectedStatus)
  const [localCategory, setLocalCategory] = useState<string[]>(selectedCategory)
  const [localQuickFilter, setLocalQuickFilter] = useState<string | null>(quickFilter)

  const hasActiveFilters =
    selectedStatus.length > 0 ||
    (selectedCategory.length > 0 && selectedCategory[0] !== 'sneaker') ||
    quickFilter !== null

  const handleApply = () => {
    onStatusChange(localStatus)
    onCategoryChange(localCategory)
    onQuickFilterChange(localQuickFilter)
    onOpenChange(false)
  }

  const handleClear = () => {
    setLocalStatus([])
    setLocalCategory(['sneaker']) // Default to sneaker
    setLocalQuickFilter(null)
    onClearAll()
    onOpenChange(false)
  }

  const toggleStatus = (key: string) => {
    if (localStatus.includes(key)) {
      setLocalStatus(localStatus.filter(s => s !== key))
    } else {
      setLocalStatus([...localStatus, key])
    }
  }

  const selectCategory = (key: string) => {
    setLocalCategory([key])
  }

  const toggleQuickFilter = (key: string) => {
    setLocalQuickFilter(localQuickFilter === key ? null : key)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-[#0E1A15] border-t-2 border-[#00FF94]/20 p-0 rounded-t-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0E1A15] border-b border-[#15251B] p-4">
          <div className="flex items-center justify-between mb-1">
            <SheetTitle className="text-lg font-semibold text-fg">Filters</SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-elev-2 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-muted" />
            </button>
          </div>
          <SheetDescription className="text-sm text-muted">
            Refine your inventory view
          </SheetDescription>
        </div>

        {/* Filter Content */}
        <div className="overflow-y-auto h-[calc(85vh-140px)] px-4 py-6 space-y-6">
          {/* Status Filter */}
          <div>
            <h3 className="text-sm font-semibold text-[#00FF94] uppercase tracking-wide mb-3">
              Status
            </h3>
            <div className="space-y-2">
              {statusOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => toggleStatus(option.key)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200',
                    localStatus.includes(option.key)
                      ? 'bg-[#00FF94]/10 border-2 border-[#00FF94]/50'
                      : 'bg-elev-1 border-2 border-border/30 hover:border-[#00FF94]/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        localStatus.includes(option.key)
                          ? 'bg-[#00FF94] border-[#00FF94]'
                          : 'border-muted'
                      )}
                    >
                      {localStatus.includes(option.key) && (
                        <Check className="h-3 w-3 text-black" />
                      )}
                    </div>
                    <span className="text-fg font-medium">{option.label}</span>
                  </div>
                  <Badge variant="outline" className="bg-elev-2 text-muted">
                    {option.count}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="text-sm font-semibold text-[#00FF94] uppercase tracking-wide mb-3">
              Category
            </h3>
            <div className="space-y-2">
              {categoryOptions
                .filter(option => option.count > 0) // Only show categories with items
                .map(option => (
                  <button
                    key={option.key}
                    onClick={() => selectCategory(option.key)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200',
                      localCategory.includes(option.key)
                        ? 'bg-[#00FF94]/10 border-2 border-[#00FF94]/50'
                        : 'bg-elev-1 border-2 border-border/30 hover:border-[#00FF94]/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                          localCategory.includes(option.key)
                            ? 'bg-[#00FF94] border-[#00FF94]'
                            : 'border-muted'
                        )}
                      >
                        {localCategory.includes(option.key) && (
                          <div className="w-2 h-2 rounded-full bg-black" />
                        )}
                      </div>
                      <span className="text-fg font-medium">{option.label}</span>
                    </div>
                    <Badge variant="outline" className="bg-elev-2 text-muted">
                      {option.count}
                    </Badge>
                  </button>
                ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <h3 className="text-sm font-semibold text-[#00FF94] uppercase tracking-wide mb-3">
              Quick Filters
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickFilterOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => toggleQuickFilter(option.key)}
                  className={cn(
                    'p-3 rounded-lg font-medium text-sm transition-all duration-200 border-2',
                    localQuickFilter === option.key
                      ? `bg-${option.color}/20 border-${option.color} text-${option.color}`
                      : 'bg-elev-1 border-border/30 text-fg hover:border-[#00FF94]/30'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#0E1A15] border-t border-[#15251B] p-4 flex gap-3">
          <Button
            variant="outline"
            onClick={handleClear}
            className="flex-1 border-border hover:bg-elev-2"
            disabled={!hasActiveFilters}
          >
            Clear All
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 bg-[#00FF94] hover:bg-[#00E085] text-black font-semibold"
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
