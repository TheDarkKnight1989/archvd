'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface AddToWatchlistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  watchlistId: string
  watchlistName: string
  onItemAdded?: () => void
  // Pre-filled values (optional)
  defaultSku?: string
  defaultSize?: string
  defaultTargetPrice?: number
}

export function AddToWatchlistDialog({
  open,
  onOpenChange,
  watchlistId,
  watchlistName,
  onItemAdded,
  defaultSku,
  defaultSize,
  defaultTargetPrice,
}: AddToWatchlistDialogProps) {
  const [sku, setSku] = useState(defaultSku || '')
  const [size, setSize] = useState(defaultSize || '')
  const [targetPrice, setTargetPrice] = useState(defaultTargetPrice?.toString() || '')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    // Validation
    if (!sku.trim()) {
      setError('SKU is required')
      return
    }

    const targetPriceNum = targetPrice ? parseFloat(targetPrice) : null
    if (targetPrice && (isNaN(targetPriceNum!) || targetPriceNum! < 0)) {
      setError('Target price must be a valid positive number')
      return
    }

    setAdding(true)
    setError('')

    try {
      const response = await fetch(`/api/watchlists/${watchlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.toUpperCase().trim(),
          size: size.trim() || null,
          target_price: targetPriceNum,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add item')
      }

      // Reset form
      setSku('')
      setSize('')
      setTargetPrice('')
      onOpenChange(false)

      // Notify parent
      if (onItemAdded) {
        onItemAdded()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add item to watchlist')
    } finally {
      setAdding(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !adding) {
      setSku(defaultSku || '')
      setSize(defaultSize || '')
      setTargetPrice(defaultTargetPrice?.toString() || '')
      setError('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-elev-2/95 backdrop-blur-md shadow-xl">
        <DialogHeader>
          <DialogTitle>Add to {watchlistName}</DialogTitle>
          <DialogDescription>
            Enter SKU, size, and optional target price
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="add-sku">SKU *</Label>
            <Input
              id="add-sku"
              placeholder="e.g., DZ5485-410"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value.toUpperCase())
                setError('')
              }}
              disabled={adding}
              className="bg-elev-1 border-border focus:ring-focus font-mono"
              aria-label="SKU"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-size">Size (optional)</Label>
            <Input
              id="add-size"
              placeholder="e.g., UK9, US10, 42"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={adding}
              className="bg-elev-1 border-border focus:ring-focus"
              aria-label="Size"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-target-price">Target Price (optional, GBP)</Label>
            <Input
              id="add-target-price"
              type="number"
              placeholder="e.g., 150"
              value={targetPrice}
              onChange={(e) => {
                setTargetPrice(e.target.value)
                setError('')
              }}
              disabled={adding}
              className="bg-elev-1 border-border focus:ring-focus font-mono"
              min="0"
              step="0.01"
              aria-label="Target price in GBP"
            />
            <p className="text-xs text-muted">
              You'll get notified when the price meets or goes below this target
            </p>
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={adding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={adding || !sku.trim()}
            className="bg-accent text-black hover:bg-accent-600"
          >
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Watchlist'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
