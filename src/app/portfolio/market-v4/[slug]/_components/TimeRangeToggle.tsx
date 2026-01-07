'use client'

/**
 * TimeRangeToggle - Select chart time range
 *
 * Options: 7D, 30D, 90D, 13M, ALL
 */

import type { TimeRange } from '@/hooks/useMarketPageData'

interface TimeRangeToggleProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  disabled?: boolean
}

const RANGES: TimeRange[] = ['7D', '30D', '90D', '13M', 'ALL']

export function TimeRangeToggle({ value, onChange, disabled }: TimeRangeToggleProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {RANGES.map((range) => (
        <button
          key={range}
          onClick={() => onChange(range)}
          disabled={disabled}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === range
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {range}
        </button>
      ))}
    </div>
  )
}
