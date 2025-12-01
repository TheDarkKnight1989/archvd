'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useListingOperations, calculateListingFees } from '@/hooks/useStockxListings'

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

interface RepriceListingModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  listing: {
    stockx_listing_id: string
    ask_price: number
    market_lowest_ask?: number
    product_name?: string
    sku?: string
    alias_image_url?: string
    stockx_image_url?: string
    image_url?: string
    image?: { url: string; alt: string }
  }
  invested: number
}

export function RepriceListingModal({ open, onClose, onSuccess, listing, invested }: RepriceListingModalProps) {
  const { updateListing, loading, error } = useListingOperations()
  const [newPrice, setNewPrice] = useState('')

  const suggested = listing.market_lowest_ask
    ? Math.round((listing.market_lowest_ask - 5) * 100) / 100
    : listing.ask_price

  useEffect(() => {
    if (open) {
      setNewPrice(suggested.toString())
    }
  }, [open, suggested])

  const fees = newPrice ? calculateListingFees(parseFloat(newPrice)) : null
  const profit = fees ? fees.netPayout - invested : 0

  const handleSubmit = async () => {
    try {
      await updateListing({
        listingId: listing.stockx_listing_id,
        askPrice: parseFloat(newPrice),
      })
      onSuccess()
      onClose()
    } catch (err) {
      // Error handled by hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-elev-2/95 backdrop-blur-md shadow-xl">
        <DialogHeader>
          <DialogTitle>Reprice Listing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-b pb-3 flex gap-3">
            {/* Product Image - Alias → StockX → Inventory priority */}
            {(listing.alias_image_url || listing.image?.url || listing.stockx_image_url || listing.image_url) && (
              <img
                src={listing.alias_image_url || listing.image?.url || listing.stockx_image_url || listing.image_url}
                alt={listing.product_name || listing.sku}
                className="w-16 h-16 rounded-lg object-cover bg-elev-2 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium">{listing.product_name || listing.sku}</p>
              <p className="text-sm text-muted-foreground">Current: {formatCurrency(listing.ask_price, 'GBP')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPrice">New Ask Price (GBP)</Label>
            <Input
              id="newPrice"
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            {listing.market_lowest_ask && (
              <p className="text-xs text-muted-foreground">
                Market: {formatCurrency(listing.market_lowest_ask, 'GBP')} (Suggested: {formatCurrency(suggested, 'GBP')})
              </p>
            )}
          </div>

          {fees && (
            <div className="space-y-1 text-sm rounded-lg border p-3 bg-muted/50">
              <div className="flex justify-between">
                <span>Net Payout</span>
                <span className="font-medium">{formatCurrency(fees.netPayout, 'GBP')}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit</span>
                <span className={profit > 0 ? 'text-green-500' : 'text-red-500'}>
                  {formatCurrency(profit, 'GBP')}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !newPrice} className="flex-1">
              {loading ? 'Updating...' : 'Update Price'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
