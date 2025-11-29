/**
 * Collapsible Section Component
 * Reusable accordion-style section with expand/collapse functionality
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CollapsibleSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  defaultExpanded?: boolean
  children: React.ReactNode
  badge?: string | number
  className?: string
  priority?: 'high' | 'medium' | 'low'
}

export function CollapsibleSection({
  title,
  description,
  icon,
  defaultExpanded = true,
  children,
  badge,
  className,
  priority = 'medium'
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const priorityColors = {
    high: 'border-accent/40 bg-accent/5',
    medium: 'border-border/30 bg-elev-1',
    low: 'border-border/20 bg-elev-0'
  }

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      priorityColors[priority],
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-elev-1/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-fg">{title}</h3>
              {badge !== undefined && (
                <div className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded font-semibold">
                  {badge}
                </div>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-dim" />
          ) : (
            <ChevronDown className="h-5 w-5 text-dim" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}
