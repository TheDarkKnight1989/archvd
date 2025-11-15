'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, Edit, DollarSign, Eye, Trash } from 'lucide-react'

export interface ActionsCellProps {
  onEdit?: () => void
  onMarkSold?: () => void
  onAddExpense?: () => void
  onAddToWatchlist?: () => void
  onDelete?: () => void
  status: 'active' | 'listed' | 'worn' | 'sold' | 'archived'
}

/**
 * ActionsCell - Row actions dropdown menu
 * WHY: Provide item-level actions (edit, mark sold, expenses, watchlist)
 */
export function ActionsCell({
  onEdit,
  onMarkSold,
  onAddExpense,
  onAddToWatchlist,
  onDelete,
  status,
}: ActionsCellProps) {
  return (
    <div className="flex items-center justify-center">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-elev-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Row actions"
          >
            <MoreVertical className="h-4 w-4 text-muted" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[180px] bg-surface border border-border rounded-xl shadow-dropdown p-1 z-50"
            sideOffset={5}
            align="end"
          >
            {onEdit && (
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-1 cursor-pointer focus-visible:outline-none focus-visible:bg-elev-1"
                onSelect={onEdit}
              >
                <Edit className="h-4 w-4 text-muted" />
                Edit item
              </DropdownMenu.Item>
            )}

            {onMarkSold && status !== 'sold' && (
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-1 cursor-pointer focus-visible:outline-none focus-visible:bg-elev-1"
                onSelect={onMarkSold}
              >
                <DollarSign className="h-4 w-4 text-muted" />
                Mark as sold
              </DropdownMenu.Item>
            )}

            {onAddExpense && (
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-1 cursor-pointer focus-visible:outline-none focus-visible:bg-elev-1"
                onSelect={onAddExpense}
              >
                <DollarSign className="h-4 w-4 text-muted" />
                Add expense
              </DropdownMenu.Item>
            )}

            {onAddToWatchlist && (
              <DropdownMenu.Item
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg hover:bg-elev-1 cursor-pointer focus-visible:outline-none focus-visible:bg-elev-1"
                onSelect={onAddToWatchlist}
              >
                <Eye className="h-4 w-4 text-muted" />
                Add to watchlist
              </DropdownMenu.Item>
            )}

            {onDelete && (
              <>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer focus-visible:outline-none focus-visible:bg-red-50"
                  onSelect={onDelete}
                >
                  <Trash className="h-4 w-4" />
                  Delete
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
