/**
 * Audit Log Component
 * Recent activity tracking for expenses
 */

'use client'

import { useState, useEffect } from 'react'
import { History, FileText, Edit2, Trash2, Upload, Repeat, Download, Tag } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AuditEntry {
  id: string
  action: 'created' | 'edited' | 'deleted' | 'receipt_uploaded' | 'recurring_created' | 'exported' | 'tagged'
  description: string
  timestamp: string
  metadata?: any
}

interface AuditLogProps {
  className?: string
}

const ACTION_ICONS = {
  created: FileText,
  edited: Edit2,
  deleted: Trash2,
  receipt_uploaded: Upload,
  recurring_created: Repeat,
  exported: Download,
  tagged: Tag,
}

const ACTION_COLORS = {
  created: 'text-green-400',
  edited: 'text-blue-400',
  deleted: 'text-red-400',
  receipt_uploaded: 'text-purple-400',
  recurring_created: 'text-accent',
  exported: 'text-amber-400',
  tagged: 'text-pink-400',
}

const ACTION_LABELS = {
  created: 'Created',
  edited: 'Edited',
  deleted: 'Deleted',
  receipt_uploaded: 'Receipt Uploaded',
  recurring_created: 'Auto-Created',
  exported: 'Exported',
  tagged: 'Tagged',
}

export function AuditLog({ className }: AuditLogProps) {
  // Load audit log from localStorage
  const [entries, setEntries] = useState<AuditEntry[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expense_audit_log')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return []
        }
      }
    }
    return []
  })

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Function to add new audit entry (exported for external use)
  const addEntry = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    }

    const updated = [newEntry, ...entries].slice(0, 50) // Keep last 50 entries
    setEntries(updated)

    if (typeof window !== 'undefined') {
      localStorage.setItem('expense_audit_log', JSON.stringify(updated))
    }
  }

  // Expose addEntry function globally for use in parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).addExpenseAuditEntry = addEntry
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).addExpenseAuditEntry
      }
    }
  }, [entries])

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Recent Activity</h3>
          <p className="text-sm text-muted mt-0.5">Last {Math.min(entries.length, 10)} actions</p>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
              <History className="h-8 w-8 text-dim" />
            </div>
            <p className="text-fg font-medium mb-1">No activity yet</p>
            <p className="text-sm text-muted">Your expense actions will appear here</p>
          </div>
        ) : (
          entries.slice(0, 10).map((entry) => {
            const Icon = ACTION_ICONS[entry.action]
            const color = ACTION_COLORS[entry.action]
            const label = ACTION_LABELS[entry.action]

            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 bg-elev-0 rounded-lg border border-border/30 hover:border-accent/30 transition-colors"
              >
                <div className={cn('flex-shrink-0 mt-0.5', color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-xs font-semibold', color)}>{label}</span>
                    <span className="text-xs text-dim">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <p className="text-sm text-fg truncate">{entry.description}</p>
                  {entry.metadata && (
                    <div className="text-xs text-muted mt-1">
                      {entry.metadata.amount && <span>Amount: {entry.metadata.amount} • </span>}
                      {entry.metadata.category && <span className="capitalize">{entry.metadata.category}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {entries.length > 10 && (
        <div className="mt-3 text-center text-xs text-dim">
          +{entries.length - 10} older activities
        </div>
      )}
    </div>
  )
}
