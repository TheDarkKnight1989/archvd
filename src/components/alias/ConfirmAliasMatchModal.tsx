'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle } from 'lucide-react'

interface MatchSuggestion {
  catalogId: string
  name: string
  sku: string
  brand: string
  confidence: number
}

interface ConfirmAliasMatchModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  inventorySku: string
  inventoryName: string
  suggestion: MatchSuggestion
  loading?: boolean
}

export function ConfirmAliasMatchModal({
  open,
  onClose,
  onConfirm,
  inventorySku,
  inventoryName,
  suggestion,
  loading = false,
}: ConfirmAliasMatchModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirm Alias Match</DialogTitle>
          <DialogDescription>
            We found a potential match for this item in the Alias catalog
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Your Item */}
          <div className="rounded-lg border border-border bg-soft p-4">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Your Inventory Item
            </div>
            <div className="text-sm font-medium text-fg">{inventoryName}</div>
            <div className="text-xs text-muted mono mt-1">SKU: {inventorySku}</div>
          </div>

          {/* Match Arrow */}
          <div className="flex justify-center">
            <div className="text-[#00FF94]">
              ↓
            </div>
          </div>

          {/* Suggested Match */}
          <div className="rounded-lg border-2 border-[#00FF94]/40 bg-[#00FF94]/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-[#00FF94] uppercase tracking-wide">
                Suggested Alias Match
              </div>
              <div className="flex items-center gap-1 text-xs text-[#00FF94]">
                <CheckCircle className="h-3 w-3" />
                {Math.round(suggestion.confidence * 100)}% confidence
              </div>
            </div>
            <div className="text-sm font-medium text-fg">{suggestion.name}</div>
            <div className="text-xs text-muted mono mt-1">
              SKU: {suggestion.sku}
            </div>
            <div className="text-xs text-muted mt-1">
              Brand: {suggestion.brand}
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-400">
            <div className="font-semibold mb-1">⚠️ Please verify this match</div>
            <div>
              Make sure the suggested item matches your inventory item before continuing.
              Incorrect mappings can lead to wrong market data and listing issues.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium"
          >
            {loading ? 'Confirming...' : 'Confirm & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
