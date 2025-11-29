'use client'

import { useState, useEffect } from 'react'
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

interface SetPriceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (priceUSD: number) => void
  productName: string
  imageUrl?: string // Product image URL (Alias → StockX → Inventory priority)
  marketPrice?: number // in USD (Alias uses USD)
  loading?: boolean
}

export function SetPriceModal({
  open,
  onOpenChange,
  onConfirm,
  productName,
  imageUrl,
  marketPrice,
  loading = false,
}: SetPriceModalProps) {
  // Suggest 10% markup over market price, or $100 default
  const suggestedPrice = marketPrice ? Math.ceil(marketPrice * 1.1) : 100

  const [price, setPrice] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Reset price when modal opens (do NOT prefill - user must enter manually)
  useEffect(() => {
    if (open) {
      setPrice('')
      setError('')
    }
  }, [open])

  const handleConfirm = () => {
    console.log('[SetPriceModal] handleConfirm called, price:', price)
    const priceNum = parseFloat(price)

    if (isNaN(priceNum) || priceNum <= 0) {
      console.error('[SetPriceModal] Invalid price:', priceNum)
      setError('Please enter a valid price')
      return
    }

    if (priceNum < 25) {
      console.error('[SetPriceModal] Price too low:', priceNum)
      setError('Minimum price is $25')
      return
    }

    if (priceNum > 2000) {
      console.error('[SetPriceModal] Price too high:', priceNum)
      setError('Maximum price is $2000')
      return
    }

    console.log('[SetPriceModal] Calling onConfirm with:', priceNum)
    onConfirm(priceNum)
  }

  const handlePriceChange = (value: string) => {
    setPrice(value)
    setError('')
  }

  // Handle suggestion button clicks - only prefills the input
  const applySuggestion = (priceValue: number) => {
    setPrice(Math.round(priceValue).toString())
    setError('')
  }

  // Prevent ANY form submission - MUST be explicit button click only
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[SetPriceModal] Form submit prevented - use button only!')
    return false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Listing Price</DialogTitle>
          <DialogDescription className="flex gap-3 items-start pt-2">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={productName}
                className="w-16 h-16 rounded-lg object-cover bg-elev-2 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              Choose your asking price for {productName}
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleFormSubmit}>
        <div className="grid gap-4 py-4">
          {marketPrice && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="text-sm text-muted-foreground">Market Reference (USD)</div>
              <div className="text-lg font-semibold">${marketPrice.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Current lowest ask on Alias (what buyers pay)
              </div>
            </div>
          )}

          {/* Smart Suggestions */}
          {marketPrice && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Smart Suggestions</div>
              <div className="grid grid-cols-3 gap-2">
                {/* Match Market Price */}
                <button
                  type="button"
                  onClick={() => applySuggestion(marketPrice)}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/50 hover:bg-blue-500/20 transition-all text-left disabled:opacity-50"
                >
                  <div className="text-xs text-muted-foreground mb-1">Match Market</div>
                  <div className="text-sm font-bold">${Math.round(marketPrice)}</div>
                </button>

                {/* 10% Markup */}
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestedPrice)}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/50 hover:bg-green-500/20 transition-all text-left disabled:opacity-50"
                >
                  <div className="text-xs text-muted-foreground mb-1">+10% Markup</div>
                  <div className="text-sm font-bold">${Math.round(suggestedPrice)}</div>
                </button>

                {/* Beat by 5% */}
                <button
                  type="button"
                  onClick={() => applySuggestion(marketPrice * 0.95)}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/50 hover:bg-amber-500/20 transition-all text-left disabled:opacity-50"
                >
                  <div className="text-xs text-muted-foreground mb-1">Beat by 5%</div>
                  <div className="text-sm font-bold">${Math.round(marketPrice * 0.95)}</div>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="price">Your Asking Price (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="price"
                type="number"
                min="25"
                max="2000"
                step="1"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="pl-7"
                placeholder="Enter price"
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Price must be between $25 and $2000
            </p>
          </div>

          {marketPrice && parseFloat(price) > 0 && (
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your price:</span>
                <span className="font-medium">${parseFloat(price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Market price:</span>
                <span>${marketPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className={parseFloat(price) > marketPrice ? 'text-green-600' : 'text-destructive'}>
                  {parseFloat(price) > marketPrice ? 'Markup:' : 'Below market:'}
                </span>
                <span className={parseFloat(price) > marketPrice ? 'text-green-600' : 'text-destructive'}>
                  {parseFloat(price) > marketPrice ? '+' : ''}
                  ${(parseFloat(price) - marketPrice).toFixed(2)}
                  {' '}
                  ({parseFloat(price) > marketPrice ? '+' : ''}
                  {(((parseFloat(price) - marketPrice) / marketPrice) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !!error || !price || parseFloat(price) <= 0}
          >
            {loading ? 'Creating...' : 'List on Alias'}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
