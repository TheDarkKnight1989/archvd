// @ts-nocheck
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, X } from 'lucide-react'

interface ListOnStockXModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: any
}

export function ListOnStockXModal({
  open,
  onClose,
  onSuccess,
  item,
}: ListOnStockXModalProps) {
  const [askPrice, setAskPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Get currency from item or default to GBP
  const currency = item?.market_currency || 'GBP'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stockx/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: item.id,
          askPrice: parseFloat(askPrice),
          currencyCode: currency,
        }),
      })

      const data = await response.json()

      console.log('[List on StockX] API response:', { status: response.status, data })

      if (!response.ok) {
        if (data.code === 'NO_MAPPING') {
          throw new Error(
            'This item is not linked to StockX. Please map it first in the StockX Mappings page.'
          )
        } else if (data.code === 'INCOMPLETE_MAPPING') {
          throw new Error(
            'StockX mapping is incomplete. Missing product or variant ID.'
          )
        } else {
          const errorMsg = data.error || data.details || `API error (${response.status})`
          throw new Error(errorMsg)
        }
      }

      if (data.success === false) {
        throw new Error(data.error || data.details || 'Listing creation failed')
      }

      console.log('[List on StockX] Listing created:', data)
      setSuccess(true)

      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1500)
    } catch (err: any) {
      console.error('[List on StockX] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setAskPrice('')
      setError(null)
      setSuccess(false)
      onClose()
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>List on StockX</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Info */}
          <div className="space-y-2">
            <div className="text-sm font-medium">{item.brand} {item.model}</div>
            <div className="text-sm text-muted-foreground">
              {item.colorway} • Size {item.size_uk || item.size} {item.size_uk ? 'UK' : ''}
            </div>
          </div>

          {/* Ask Price Input */}
          <div className="space-y-2">
            <Label htmlFor="askPrice">
              Ask Price ({currency})
            </Label>
            <Input
              id="askPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder={`Enter your ask price in ${currency}`}
              value={askPrice}
              onChange={(e) => setAskPrice(e.target.value)}
              required
              disabled={loading || success}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              <X className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Listing created successfully!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading || success}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || success || !askPrice}
              className="bg-[#00B050] hover:bg-[#00B050]/90 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {success ? 'Created!' : loading ? 'Creating...' : 'Create Listing'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
