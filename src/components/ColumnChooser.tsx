'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Columns, Lock, RotateCcw } from 'lucide-react'

export interface ColumnConfig {
  key: string
  label: string
  visible: boolean
  lock?: boolean
}

export interface ColumnChooserProps {
  columns: ColumnConfig[]
  onChange: (next: { key: string; visible: boolean }[]) => void
  defaultColumns?: ColumnConfig[]
}

export function ColumnChooser({
  columns,
  onChange,
  defaultColumns,
}: ColumnChooserProps) {
  const [open, setOpen] = useState(false)

  const handleToggle = (key: string) => {
    const column = columns.find((c) => c.key === key)
    if (column?.lock) return

    const next = columns.map((col) => ({
      key: col.key,
      visible: col.key === key ? !col.visible : col.visible,
    }))

    onChange(next)
  }

  const handleReset = () => {
    if (!defaultColumns) return

    const next = defaultColumns.map((col) => ({
      key: col.key,
      visible: col.visible,
    }))

    onChange(next)
  }

  const visibleCount = columns.filter((c) => c.visible).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-border hover:border-accent/60 transition-all duration-120"
          aria-label="Choose visible columns"
        >
          <Columns className="h-4 w-4 mr-2" />
          Columns
          {visibleCount < columns.length && (
            <span className="ml-1.5 text-xs text-dim">({visibleCount})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] bg-[#0E1A15] border-[#15251B] p-3 space-y-2"
        align="end"
      >
        <div className="text-xs font-medium text-[#7FA08F] uppercase tracking-wide px-1">
          Toggle Columns
        </div>

        <div className="space-y-1 max-h-[320px] overflow-y-auto">
          {columns.map((column) => (
            <button
              key={column.key}
              onClick={() => handleToggle(column.key)}
              disabled={column.lock}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-120',
                column.lock
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:bg-[#0B1510] cursor-pointer',
                column.visible && !column.lock && 'bg-[#08100C]'
              )}
              role="checkbox"
              aria-checked={column.visible}
              aria-label={`${column.visible ? 'Hide' : 'Show'} ${column.label} column`}
            >
              <div
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all duration-120',
                  column.visible
                    ? 'bg-[#00FF94] border-[#00FF94]'
                    : 'border-[#15251B] bg-[#0B1510]'
                )}
              >
                {column.visible && (
                  <svg
                    className="h-3 w-3 text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              <span className="flex-1 text-left text-[#E8F6EE]">{column.label}</span>

              {column.lock && (
                <Lock className="h-3.5 w-3.5 text-[#7FA08F] shrink-0" aria-label="Locked column" />
              )}
            </button>
          ))}
        </div>

        {defaultColumns && (
          <div className="pt-2 border-t border-[#15251B]/40">
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="w-full border-[#15251B]/60 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to default
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
