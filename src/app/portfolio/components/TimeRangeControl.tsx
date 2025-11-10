'use client'

import { cn } from '@/lib/utils/cn'

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'lifetime'

interface TimeRangeControlProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  className?: string
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'lifetime', label: 'All' },
]

export function TimeRangeControl({ value, onChange, className }: TimeRangeControlProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-elev-1 border border-border p-1',
        className
      )}
      role="group"
      aria-label="Time range selector"
    >
      {ranges.map((range) => {
        const isActive = value === range.value

        return (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-120',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
              isActive
                ? 'bg-accent text-black shadow-soft'
                : 'text-muted hover:text-fg hover:bg-elev-2'
            )}
            aria-pressed={isActive}
          >
            {range.label}
          </button>
        )
      })}
    </div>
  )
}
