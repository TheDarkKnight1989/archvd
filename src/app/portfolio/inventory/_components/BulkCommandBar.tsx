/**
 * Bulk Command Bar
 * Floating action bar for bulk operations on selected inventory items
 * Clean, minimal design inspired by Linear/Notion
 */

'use client'

import { useMemo } from 'react'
import {
  PauseCircle,
  PlayCircle,
  DollarSign,
  Trash2,
  X,
  Package,
  Tag,
  Copy,
  Upload,
  Printer,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { InventoryV4ItemFull } from '@/lib/inventory-v4/types'

interface BulkCommandBarProps {
  selectedItems: InventoryV4ItemFull[]
  filteredItemsCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  // StockX actions
  onListOnStockX: () => void
  onPauseListings: () => void
  onActivateListings: () => void
  onRepriceListings: () => void
  onDeleteListings: () => void
  onPrintLabels: () => void
  // Status actions
  onMarkSold: () => void
  onMarkUnlisted: () => void
  // Inventory actions
  onDelete: () => void
  onDuplicate: () => void
}

export function BulkCommandBar({
  selectedItems,
  filteredItemsCount,
  onSelectAll,
  onClearSelection,
  onListOnStockX,
  onPauseListings,
  onActivateListings,
  onRepriceListings,
  onDeleteListings,
  onPrintLabels,
  onMarkSold,
  onMarkUnlisted,
  onDelete,
  onDuplicate,
}: BulkCommandBarProps) {
  const count = selectedItems.length

  // Compute action availability based on selection
  const stats = useMemo(() => {
    let withActiveListings = 0
    let withPausedListings = 0
    let withAnyStockxListing = 0
    let canListOnStockx = 0

    for (const item of selectedItems) {
      const sxListing = item.listings.find(l => l.platform === 'stockx')

      // Can list if has StockX product mapping but no listing
      if (item.style.stockx_product_id && !sxListing) {
        canListOnStockx++
      }

      if (sxListing) {
        withAnyStockxListing++
        if (sxListing.status === 'active') withActiveListings++
        if (sxListing.status === 'paused') withPausedListings++
      }
    }

    return { withActiveListings, withPausedListings, withAnyStockxListing, canListOnStockx }
  }, [selectedItems])

  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-4 px-4 pointer-events-none">
      <div className="max-w-fit mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1 px-2 py-2">
            {/* Selection count */}
            <div className="flex items-center gap-2 px-3 border-r border-zinc-700/50">
              <span className="text-sm font-medium text-white tabular-nums">
                {count}
              </span>
              <span className="text-sm text-zinc-400">selected</span>
              {count < filteredItemsCount && (
                <button
                  onClick={onSelectAll}
                  className="text-xs text-orange-400 hover:text-orange-300 ml-1"
                >
                  All
                </button>
              )}
            </div>

            {/* StockX: List */}
            {stats.canListOnStockx > 0 && (
              <ActionBtn
                icon={Upload}
                label="List"
                onClick={onListOnStockX}
                badge={stats.canListOnStockx}
                color="green"
              />
            )}

            {/* StockX: Pause */}
            {stats.withActiveListings > 0 && (
              <ActionBtn
                icon={PauseCircle}
                label="Pause"
                onClick={onPauseListings}
                badge={stats.withActiveListings}
                color="yellow"
              />
            )}

            {/* StockX: Activate */}
            {stats.withPausedListings > 0 && (
              <ActionBtn
                icon={PlayCircle}
                label="Activate"
                onClick={onActivateListings}
                badge={stats.withPausedListings}
                color="green"
              />
            )}

            {/* StockX: Reprice */}
            {stats.withAnyStockxListing > 0 && (
              <ActionBtn
                icon={DollarSign}
                label="Reprice"
                onClick={onRepriceListings}
                badge={stats.withAnyStockxListing}
              />
            )}

            {/* StockX: Print Labels */}
            {stats.withAnyStockxListing > 0 && (
              <ActionBtn
                icon={Printer}
                label="Labels"
                onClick={onPrintLabels}
              />
            )}

            {/* StockX: Delete Listings */}
            {stats.withAnyStockxListing > 0 && (
              <ActionBtn
                icon={XCircle}
                label="Delist"
                onClick={onDeleteListings}
                color="red"
              />
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-zinc-700/50 mx-1" />

            {/* Status: Mark Sold */}
            <ActionBtn
              icon={Tag}
              label="Sold"
              onClick={onMarkSold}
            />

            {/* Status: Mark Unlisted */}
            <ActionBtn
              icon={Package}
              label="Unlist"
              onClick={onMarkUnlisted}
            />

            {/* Divider */}
            <div className="w-px h-5 bg-zinc-700/50 mx-1" />

            {/* Inventory: Duplicate */}
            <ActionBtn
              icon={Copy}
              label="Duplicate"
              onClick={onDuplicate}
            />

            {/* Inventory: Delete */}
            <ActionBtn
              icon={Trash2}
              label="Delete"
              onClick={onDelete}
              color="red"
            />

            {/* Clear selection */}
            <button
              onClick={onClearSelection}
              className="p-1.5 ml-1 rounded hover:bg-zinc-800 transition-colors"
              title="Clear selection (Esc)"
            >
              <X className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact action button
function ActionBtn({
  icon: Icon,
  label,
  onClick,
  badge,
  color = 'default',
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  badge?: number
  color?: 'default' | 'yellow' | 'green' | 'red'
}) {
  const styles = {
    default: 'text-zinc-400 hover:text-white hover:bg-zinc-800',
    yellow: 'text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10',
    green: 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10',
    red: 'text-red-500 hover:text-red-400 hover:bg-red-500/10',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
        styles[color]
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] bg-zinc-700 px-1 py-0.5 rounded tabular-nums">
          {badge}
        </span>
      )}
    </button>
  )
}
