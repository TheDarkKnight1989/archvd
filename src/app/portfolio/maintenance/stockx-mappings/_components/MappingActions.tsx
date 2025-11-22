'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MapPinIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface MappingActionsProps {
  itemId: string
  sku: string
}

export function MappingActions({ itemId, sku }: MappingActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMapItem = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/stockx/map-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error codes
        if (data.code === 'NOT_FOUND') {
          setError(`Not found: ${data.message}`)
        } else if (data.code === 'AMBIGUOUS_MATCH') {
          setError(`Ambiguous: Found ${data.matches?.length || 'multiple'} matches for SKU "${sku}"`)
        } else if (data.code === 'NO_SIZE_MATCH') {
          setError(`Size not available. Available: ${data.availableSizes?.join(', ') || 'none'}`)
        } else {
          setError(data.error || 'Failed to map item')
        }
        return
      }

      // Success!
      setSuccess(true)

      // Refresh the page to show updated mapping status
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>Mapped successfully!</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleMapItem}
        disabled={loading}
        size="sm"
        variant="outline"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Mapping...
          </>
        ) : (
          <>
            <MapPinIcon className="mr-2 h-4 w-4" />
            Attempt StockX Mapping
          </>
        )}
      </Button>
      {error && (
        <div className="text-xs text-red-600 max-w-xs">
          {error}
        </div>
      )}
    </div>
  )
}
