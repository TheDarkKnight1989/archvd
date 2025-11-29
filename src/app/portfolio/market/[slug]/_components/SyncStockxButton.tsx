'use client'

/**
 * PHASE 3: Manual StockX Sync Button
 *
 * Safe, manual sync trigger for Market Page
 * - NO auto-refresh
 * - User-initiated only
 * - Shows loading state and success message
 */

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SyncStockxButtonProps {
  stockxProductId: string
}

export function SyncStockxButton({ stockxProductId }: SyncStockxButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    if (isSyncing) return

    setIsSyncing(true)

    try {
      console.log('[Sync Button] Starting manual sync for:', stockxProductId)

      const response = await fetch(
        `/api/stockx/sync-product?productId=${stockxProductId}`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      // Only error if success is false - warnings are OK
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync product data')
      }

      console.log('[Sync Button] ✅ Sync complete:', data)

      // Show appropriate toast based on whether there's a warning
      if (data.warning) {
        // Yellow/warning toast for partial success
        toast.warning('StockX sync complete with warning', {
          description: data.warning,
          duration: 8000,
        })
      } else {
        // Green success toast for full success
        toast.success('StockX data synced', {
          description: `Updated ${data.variantsCached} variants and ${data.snapshotsCreated} market snapshots`,
        })
      }

      // Reload page to show fresh data
      router.refresh()
    } catch (error: any) {
      console.error('[Sync Button] Sync failed:', error)

      toast.error('Sync failed', {
        description: error.message || 'Failed to sync StockX data',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={isSyncing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? 'Syncing...' : 'Sync StockX Data'}
    </Button>
  )
}
