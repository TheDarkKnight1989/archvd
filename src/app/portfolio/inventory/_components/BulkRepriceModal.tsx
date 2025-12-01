/**
 * Bulk Reprice Modal
 * Simple modal to set a single ask price for multiple StockX listings
 */

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BulkRepriceModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (askPrice: number) => void
  listingCount: number
}

export function BulkRepriceModal({
  open,
  onClose,
  onConfirm,
  listingCount
}: BulkRepriceModalProps) {
  const [askPrice, setAskPrice] = useState<string>('')

  const handleConfirm = () => {
    const price = parseFloat(askPrice)
    if (isNaN(price) || price <= 0) {
      return
    }
    onConfirm(price)
    setAskPrice('')
  }

  const handleClose = () => {
    setAskPrice('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-elev-2/95 backdrop-blur-md shadow-xl max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Reprice on StockX</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-elev-1 border border-border/50 rounded-lg p-4">
            <p className="text-sm text-muted">
              This will update <span className="font-semibold text-fg">{listingCount}</span> listing{listingCount === 1 ? '' : 's'} to the same ask price on StockX.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="askPrice">New Ask Price (£)</Label>
            <Input
              id="askPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 150.00"
              value={askPrice}
              onChange={(e) => setAskPrice(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!askPrice || parseFloat(askPrice) <= 0}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              Update {listingCount} Listing{listingCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
