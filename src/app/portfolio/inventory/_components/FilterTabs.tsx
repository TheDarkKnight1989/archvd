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
              'relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-120 snap-start shrink-0',
              'border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              'tabular-nums',
              isActive
                ? 'text-[#000000] bg-[#00FF94] border-[#00FF94] shadow-[0_0_0_1px_rgba(15,141,101,0.5)] glow-accent-hover'
                : 'text-[#E8F6EE]/80 bg-[#08100C]/50 border-[#15251B]/40 hover:bg-[#08100C] hover:border-[#00FF94]/30 hover:text-[#E8F6EE]'
            )}
            aria-pressed={isActive}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold',
                  isActive ? 'bg-[#000000]/20 text-[#000000]' : 'bg-[#0B1510]/80 text-[#B7D0C2]'
                )}
              >
                {t.count}
              </span>
            )}
            {isActive && (
              <span className="pointer-events-none absolute -bottom-[2px] left-3 right-3 h-[2px] bg-accent/80 rounded-full blur-[1px]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
