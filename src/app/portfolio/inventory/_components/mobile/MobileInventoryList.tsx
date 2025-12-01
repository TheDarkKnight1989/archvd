'use client'

import { useMemo } from 'react'
import { MobileInventoryItemCard } from './MobileInventoryItemCard'
import { MobileBulkBar } from './MobileBulkBar'
import { Skeleton } from '@/components/ui/skeleton'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

interface MobileInventoryListProps {
  items: EnrichedLineItem[]
  loading: boolean
  selectedItems: Set<string>
  onSelectionChange: (selectedIds: Set<string>) => void
  onRefetch: () => void
  // StockX action handlers
  onListOnStockX?: (item: EnrichedLineItem) => void
  onRepriceListing?: (item: EnrichedLineItem) => void
  onDeactivateListing?: (item: EnrichedLineItem) => void
  onReactivateListing?: (item: EnrichedLineItem) => void
  onDeleteItem?: (item: EnrichedLineItem) => void
  // Bulk action handlers
  onBulkList?: () => void
  onBulkPause?: () => void
  onBulkActivate?: () => void
  onBulkReprice?: () => void
  onBulkDelete?: () => void
  onBulkExport?: () => void
}

export function MobileInventoryList({
  items,
  loading,
  selectedItems,
  onSelectionChange,
  onRefetch,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteItem,
  onBulkList,
  onBulkPause,
  onBulkActivate,
  onBulkReprice,
  onBulkDelete,
  onBulkExport,
}: MobileInventoryListProps) {
  // Check if any items are selected
  const hasSelection = selectedItems.size > 0

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-br from-elev-1 to-elev-1/80 rounded-xl p-4 border-2 border-[#00FF94]/10"
          >
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="w-16 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted text-sm mb-2">No inventory items found</p>
        <p className="text-muted text-xs">Try adjusting your filters or add new items</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Card List */}
      <div className="space-y-4 pb-24">
        {items.map((item) => (
          <MobileInventoryItemCard
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            onSelectionChange={(checked) => {
              const newSelection = new Set(selectedItems)
              if (checked) {
                newSelection.add(item.id)
              } else {
                newSelection.delete(item.id)
              }
              onSelectionChange(newSelection)
            }}
            onListOnStockX={onListOnStockX ? () => onListOnStockX(item) : undefined}
            onRepriceListing={onRepriceListing ? () => onRepriceListing(item) : undefined}
            onDeactivateListing={onDeactivateListing ? () => onDeactivateListing(item) : undefined}
            onReactivateListing={onReactivateListing ? () => onReactivateListing(item) : undefined}
            onDeleteItem={onDeleteItem ? () => onDeleteItem(item) : undefined}
          />
        ))}
      </div>

      {/* Sticky Bottom Bulk Actions Bar */}
      {hasSelection && (
        <MobileBulkBar
          selectedCount={selectedItems.size}
          onClearSelection={() => onSelectionChange(new Set())}
          onBulkList={onBulkList}
          onBulkPause={onBulkPause}
          onBulkActivate={onBulkActivate}
          onBulkReprice={onBulkReprice}
          onBulkDelete={onBulkDelete}
          onBulkExport={onBulkExport}
        />
      )}
    </div>
  )
}
