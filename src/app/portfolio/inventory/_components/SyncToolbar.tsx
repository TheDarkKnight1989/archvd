'use client'

/**
 * SyncToolbar - Market data sync controls
 *
 * Features:
 * - "Last synced" indicator showing most recent sync timestamp
 * - "Sync Now" button that triggers market jobs via API
 * - Loading state during sync operations
 * - Success/error feedback
 *
 * Architecture:
 * - NO direct StockX API calls
 * - Uses /api/portfolio/sync endpoint to create market_jobs
 * - Worker processes jobs asynchronously
 * - Results stored in stockx_market_latest view
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SyncToolbarProps {
  lastSyncedAt?: string | null
  onSyncNow?: () => Promise<void>
  className?: string
}

export function SyncToolbar({ lastSyncedAt, onSyncNow, className }: SyncToolbarProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null)

  const handleSync = async () => {
    if (!onSyncNow) return

    try {
      setSyncing(true)
      setSyncResult(null)
      await onSyncNow()
      setSyncResult('success')

      // Clear success message after 3 seconds
      setTimeout(() => setSyncResult(null), 3000)
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncResult('error')

      // Clear error message after 5 seconds
      setTimeout(() => setSyncResult(null), 5000)
    } finally {
      setSyncing(false)
    }
  }

  const formatLastSynced = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Never synced'

    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    // For older dates, show full date
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className={cn('flex items-center gap-4 p-3 bg-soft/30 rounded-lg border border-border', className)}>
      {/* Last Synced Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted" />
        <span className="text-muted">Last synced:</span>
        <span className="font-medium mono text-fg">
          {formatLastSynced(lastSyncedAt)}
        </span>
      </div>

      {/* Sync Status Badge */}
      {syncResult === 'success' && (
        <div className="flex items-center gap-1.5 text-green-500 text-sm animate-in fade-in slide-in-from-right-2 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>Synced successfully</span>
        </div>
      )}

      {syncResult === 'error' && (
        <div className="flex items-center gap-1.5 text-red-500 text-sm animate-in fade-in slide-in-from-right-2 duration-200">
          <AlertCircle className="h-4 w-4" />
          <span>Sync failed - try again</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Sync Now Button */}
      <Button
        onClick={handleSync}
        disabled={syncing || !onSyncNow}
        variant="outline"
        size="sm"
        className={cn(
          'gap-2 transition-all',
          syncing && 'cursor-wait'
        )}
      >
        <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
      </Button>
    </div>
  )
}
