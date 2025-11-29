'use client'

/**
 * Collapsible Section Component
 *
 * Simple collapsible UI component for hiding/showing content
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-soft transition-colors text-left"
      >
        <span className="text-lg font-semibold text-fg">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 bg-card border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}
