'use client'

import { cn } from '@/lib/utils/cn'

export type DashboardView = 'portfolio' | 'reports' | 'breakdown'

interface TabBarProps {
  activeView: DashboardView
  onViewChange: (view: DashboardView) => void
}

const TABS: { value: DashboardView; label: string }[] = [
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'reports', label: 'Reports' },
  { value: 'breakdown', label: 'Breakdown' },
]

export function TabBar({ activeView, onViewChange }: TabBarProps) {
  return (
    <div className="border-b border-border/40">
      <nav className="flex gap-1" aria-label="Dashboard views">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onViewChange(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              activeView === tab.value
                ? 'text-neutral-50'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
            aria-current={activeView === tab.value ? 'page' : undefined}
          >
            {tab.label}
            {activeView === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
