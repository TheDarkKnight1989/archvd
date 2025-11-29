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
    <div className="relative border-b border-border/30">
      <nav className="flex gap-2" aria-label="Dashboard views">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onViewChange(tab.value)}
            className={cn(
              'relative px-5 py-2.5 text-sm font-semibold transition-all duration-300 rounded-t-lg group',
              activeView === tab.value
                ? 'text-accent bg-gradient-to-b from-accent/10 to-transparent'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-accent/5'
            )}
            aria-current={activeView === tab.value ? 'page' : undefined}
          >
            {/* Tab label */}
            <span className="relative z-10">{tab.label}</span>

            {/* Active state indicator - gradient underline */}
            {activeView === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent rounded-t shadow-[0_0_8px_rgba(196,164,132,0.5)]" />
            )}

            {/* Subtle glow effect on hover for active tab */}
            {activeView === tab.value && (
              <span className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-lg pointer-events-none" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
