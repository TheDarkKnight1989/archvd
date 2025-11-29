/**
 * Column Visibility Dropdown
 * Allows users to show/hide table columns
 */

'use client'

import { Settings2, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  required?: boolean // Cannot be hidden
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnConfig[]
  onToggle: (columnId: string) => void
  onReset: () => void
  className?: string
}

export function ColumnVisibilityDropdown({
  columns,
  onToggle,
  onReset,
  className,
}: ColumnVisibilityDropdownProps) {
  const visibleCount = columns.filter((col) => col.visible).length
  const totalCount = columns.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-2 border-border/50 hover:bg-elev-1 hover:border-border transition-all',
            className
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-xs text-muted">({visibleCount}/{totalCount})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-[#0E1A15] border-[#15251B] p-2"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-[#7FA08F] uppercase tracking-wide px-2 py-1.5">
          Show Columns
        </DropdownMenuLabel>

        <div className="max-h-[300px] overflow-y-auto">
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.visible}
              onCheckedChange={() => !column.required && onToggle(column.id)}
              disabled={column.required}
              className={cn(
                'text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer',
                column.required && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                {column.visible ? (
                  <Eye className="h-3.5 w-3.5 text-[#00FF94]" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted" />
                )}
                <span className="flex-1">{column.label}</span>
                {column.required && (
                  <span className="text-xs text-muted">Required</span>
                )}
              </div>
            </DropdownMenuCheckboxItem>
          ))}
        </div>

        <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />

        <DropdownMenuItem
          onClick={onReset}
          className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
