'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

interface NoAliasMatchModalProps {
  open: boolean
  onClose: () => void
  inventorySku: string
  inventoryName: string
}

export function NoAliasMatchModal({
  open,
  onClose,
  inventorySku,
  inventoryName,
}: NoAliasMatchModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>No Alias Match Found</DialogTitle>
          <DialogDescription>
            We couldn't find a match for this item in the Alias catalog
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Info */}
          <div className="rounded-lg border border-border bg-soft p-4">
            <div className="text-sm font-medium text-fg">{inventoryName}</div>
            <div className="text-xs text-muted mono mt-1">SKU: {inventorySku}</div>
          </div>

          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-red-500/10 p-3">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>

          {/* Message */}
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-center">
            <div className="text-sm text-fg font-medium mb-2">
              No match found in Alias catalog
            </div>
            <div className="text-xs text-muted">
              This item needs to be manually mapped before you can create an Alias listing.
              Try searching the Alias catalog manually or contact support if you believe this is an error.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
