'use client'

/**
 * V4 StockX Sync Button
 *
 * Manual sync trigger for Market Page
 * - Syncs to V4 tables (inventory_v4_stockx_*)
 * - User-initiated only
 * - Shows loading state and success message
 */

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SyncStockxButtonProps {
  sku: string
  stockxProductId?: string // Legacy, no longer used
}

export function SyncStockxButton({ sku }: SyncStockxButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    if (isSyncing) return

    setIsSyncing(true)

    try {
      console.log('[Sync Button V4] Starting sync for SKU:', sku)

      const response = await fetch(
        `/api/stockx/sync-product-v4?sku=${encodeURIComponent(sku)}`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      // Only error if success is false - warnings are OK
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync product data')
      }

      console.log('[Sync Button V4] Sync complete:', data)

      // Show appropriate toast based on whether there's a warning
      if (data.warning) {
        toast.warning('StockX sync complete with warning', {
          description: data.warning,
          duration: 8000,
        })
      } else {
        toast.success('StockX data synced (V4)', {
          description: `Synced ${data.variantsSynced} variants, ${data.marketDataRefreshed} market data rows`,
        })
      }

      // Reload page to show fresh data
      router.refresh()
    } catch (error: unknown) {
      console.error('[Sync Button V4] Sync failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync StockX data'

      toast.error('Sync failed', {
        description: errorMessage,
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
