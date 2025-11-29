/**
 * Mobile Optimization Component
 * Responsive wrapper with mobile-friendly controls and layouts
 */

'use client'

import { useState } from 'react'
import { Menu, X, ChevronDown, ChevronUp, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface MobileOptimizationProps {
  children: React.ReactNode
  className?: string
}

interface Section {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  component: React.ReactNode
}

export function MobileOptimization({ children, className }: MobileOptimizationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['kpis', 'trends']))

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div className={cn('mobile-optimized', className)}>
      {/* Mobile-only sticky header */}
      <div className="lg:hidden sticky top-0 z-40 bg-elev-1 border-b border-border p-4 -mx-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-fg">P&L Dashboard</h2>
          </div>
          <Button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            size="sm"
            variant="outline"
            className="border-border/30"
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Mobile Quick Nav */}
        {isMobileMenuOpen && (
          <div className="mt-4 space-y-2">
            <button
              onClick={() => {
                document.getElementById('kpis')?.scrollIntoView({ behavior: 'smooth' })
                setIsMobileMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 bg-elev-0 rounded text-sm text-fg hover:bg-accent/10"
            >
              Key Metrics
            </button>
            <button
              onClick={() => {
                document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth' })
                setIsMobileMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 bg-elev-0 rounded text-sm text-fg hover:bg-accent/10"
            >
              Trends & Analysis
            </button>
            <button
              onClick={() => {
                document.getElementById('insights')?.scrollIntoView({ behavior: 'smooth' })
                setIsMobileMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 bg-elev-0 rounded text-sm text-fg hover:bg-accent/10"
            >
              Performance Insights
            </button>
            <button
              onClick={() => {
                document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' })
                setIsMobileMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 bg-elev-0 rounded text-sm text-fg hover:bg-accent/10"
            >
              Transaction Details
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  )
}

interface CollapsibleSectionProps {
  id: string
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  id,
  title,
  defaultExpanded = false,
  children,
  className
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={cn('collapsible-section', className)} id={id}>
      {/* Mobile: Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="lg:hidden w-full flex items-center justify-between p-4 bg-elev-1 border border-border rounded-t-xl hover:bg-elev-0 transition-colors"
      >
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-accent" />
        ) : (
          <ChevronDown className="h-4 w-4 text-dim" />
        )}
      </button>

      {/* Content */}
      <div
        className={cn(
          'lg:block',
          isExpanded ? 'block' : 'hidden'
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface MobileCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: React.ReactNode
  icon?: React.ReactNode
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
  className?: string
}

export function MobileCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'default',
  className
}: MobileCardProps) {
  const variantStyles = {
    default: 'bg-elev-1 border-border',
    positive: 'bg-[#00FF94]/5 border-[#00FF94]/30',
    negative: 'bg-red-500/5 border-red-500/30',
    neutral: 'bg-blue-500/5 border-blue-500/30'
  }

  return (
    <div className={cn(
      'p-4 border rounded-lg',
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {icon && <div className="text-accent">{icon}</div>}
            <div className="text-xs text-dim uppercase tracking-wide">{title}</div>
          </div>
          <div className="text-2xl font-bold text-fg mono">{value}</div>
          {subtitle && <div className="text-xs text-muted mt-1">{subtitle}</div>}
        </div>
        {trend && <div className="ml-2">{trend}</div>}
      </div>
    </div>
  )
}

interface MobileTableProps {
  headers: string[]
  rows: React.ReactNode[][]
  className?: string
}

export function MobileTable({ headers, rows, className }: MobileTableProps) {
  return (
    <div className={cn('mobile-table', className)}>
      {/* Desktop: Normal table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {headers.map((header, i) => (
                <th key={i} className="text-left p-3 text-xs text-dim uppercase tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/30">
                {row.map((cell, j) => (
                  <td key={j} className="p-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card-based layout */}
      <div className="lg:hidden space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="p-4 bg-elev-0 rounded-lg border border-border/30">
            {row.map((cell, j) => (
              <div key={j} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="text-xs text-dim uppercase tracking-wide">{headers[j]}</div>
                <div className="text-sm font-medium text-fg">{cell}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

interface MobileTabsProps {
  tabs: { id: string; label: string; content: React.ReactNode }[]
  defaultTab?: string
  className?: string
}

export function MobileTabs({ tabs, defaultTab, className }: MobileTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  return (
    <div className={cn('mobile-tabs', className)}>
      {/* Tab buttons - horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-accent/20 text-fg'
                : 'bg-elev-0 text-muted hover:bg-elev-1'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  )
}
