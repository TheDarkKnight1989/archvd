'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils/cn'

type Tab = { key: string; label: string; count?: number }

type Props = {
  tabs: Tab[]
  value: string[]
  onChange: (keys: string[]) => void
  multiselect?: boolean
  className?: string
}

export function FilterTabs({ tabs, value, onChange, multiselect = true, className }: Props) {
  const active = useMemo(() => new Set(value), [value])

  function toggle(key: string) {
    if (!multiselect) {
      onChange([key])
      return
    }
    const next = new Set(active)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange([...next])
  }

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto no-scrollbar snap-x', className)}>
      {tabs.map((t) => {
        const isActive = active.has(t.key) || (!multiselect && value[0] === t.key)
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => toggle(t.key)}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-boutique snap-start shrink-0',
              'border focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              'tabular-nums',
              isActive
                ? 'text-fg bg-accent border-accent/60 shadow-soft'
                : 'text-muted bg-elev-1 border-border/60 hover:bg-elev-2 hover:border-accent/40 hover:text-fg'
            )}
            aria-pressed={isActive}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold',
                  isActive ? 'bg-fg/15 text-fg' : 'bg-elev-2 text-muted'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
