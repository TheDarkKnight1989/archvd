// @ts-nocheck
'use client'

/**
 * Bulk StockX Listing Modal
 *
 * Allows listing multiple items on StockX at once with:
 * - Filtering to only listable items (StockX-mapped and not already listed)
 * - Individual product cards with market data
 * - Per-item pricing with quick action buttons
 * - Progress tracking for each item
 */

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, X, Loader2, AlertCircle, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

// Use the actual type from inventory
export type BulkListItem = EnrichedLineItem

interface BulkListOnStockXModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  items: BulkListItem[]
}

interface ListingResult {
  itemId: string
  sku: string
  brand?: string
  model?: string
  colorway?: string
  size_uk?: string
  status: 'pending' | 'processing' | 'success' | 'error'
  error?: string
  listingId?: string
  askPrice?: number
}

export function BulkListOnStockXModal({
  open,
  onClose,
  onSuccess,
  items,
}: BulkListOnStockXModalProps) {
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ListingResult[]>([])

  // Filter to only listable items
  const listableItems = useMemo(() => {
    return items.filter(item => {
      // Must have StockX mapping
      const hasMapping = item.stockx?.mapped && item.stockx?.productId && item.stockx?.variantId

      if (!hasMapping) return false

      // Must not already be listed (or listing must be inactive)
      const isListed = !!item.stockx?.listingId &&
        (item.stockx?.listingStatus === 'ACTIVE' || item.stockx?.listingStatus === 'PENDING')

      return !isListed
    })
  }, [items])

  const unmappedCount = items.length - listableItems.length - items.filter(item => {
    const isAlreadyListed = !!item.stockx?.listingId &&
      (item.stockx?.listingStatus === 'ACTIVE' || item.stockx?.listingStatus === 'PENDING')
    return isAlreadyListed
  }).length

  const alreadyListedCount = items.filter(item => {
    const isAlreadyListed = !!item.stockx?.listingId &&
      (item.stockx?.listingStatus === 'ACTIVE' || item.stockx?.listingStatus === 'PENDING')
    return isAlreadyListed
  }).length

  const setItemPrice = (itemId: string, price: string) => {
    setItemPrices(prev => ({ ...prev, [itemId]: price }))
  }

  const setQuickPrice = (itemId: string, strategy: 'bid' | 'ask' | 'ask-5') => {
    const item = listableItems.find(i => i.id === itemId)
    if (!item) return

    // Use data from stockx object or fallback to market/instantSell
    const highestBid = item.stockx?.highestBid || item.instantSell?.gross || null
    const lowestAsk = item.stockx?.lowestAsk || item.market?.lowestAsk || null

    let price: number | null = null
    if (strategy === 'bid' && highestBid) {
      price = highestBid
    } else if (strategy === 'ask' && lowestAsk) {
      price = lowestAsk
    } else if (strategy === 'ask-5' && lowestAsk) {
      price = lowestAsk * 0.95
    }

    if (price) {
      setItemPrice(itemId, price.toFixed(2))
    }
  }

  const handleClose = () => {
    if (loading) return
    setItemPrices({})
    setResults([])
    onClose()
  }

  const handleSubmit = async () => {
    // Validate all prices are set
    const itemsToList = listableItems.filter(item => {
      const price = itemPrices[item.id]
      return price && parseFloat(price) > 0
    })

    if (itemsToList.length === 0) {
      alert('Please set prices for at least one item')
      return
    }

    setLoading(true)

    // Initialize results only for items with prices
    const initialResults: ListingResult[] = itemsToList.map(item => ({
      itemId: item.id,
      sku: item.sku,
      brand: item.brand,
      model: item.model,
      colorway: item.colorway,
      size_uk: item.size_uk,
      status: 'pending',
      askPrice: parseFloat(itemPrices[item.id]),
    }))
    setResults(initialResults)

    try {
      // Use batch API for efficiency (10-100x faster than one-by-one)
      const batchPayload = {
        listings: itemsToList.map(item => ({
          inventoryItemId: item.id,
          askPrice: parseFloat(itemPrices[item.id]),
          currencyCode: item.market?.currency || 'GBP',
        }))
      }

      console.log('[Bulk List] Creating', batchPayload.listings.length, 'listings via batch API')

      // Mark all as processing
      setResults(prev => prev.map(r => ({ ...r, status: 'processing' })))

      const response = await fetch('/api/stockx/listings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Batch creation failed')
      }

      console.log('[Bulk List] Batch completed:', data.summary)

      // Update results based on batch response
      setResults(prev => prev.map(result => {
        // Find this item in batch results
        const batchResult = data.results.find((r: any) => {
          // Match by looking up the item's StockX mapping
          const item = itemsToList.find(i => i.id === result.itemId)
          return item &&
            r.productId === item.stockx?.productId &&
            r.variantId === item.stockx?.variantId
        })

        if (!batchResult) {
          return {
            ...result,
            status: 'error',
            error: 'Not found in batch results'
          }
        }

        if (batchResult.status === 'SUCCESS') {
          return {
            ...result,
            status: 'success',
            listingId: batchResult.listingId
          }
        } else {
          return {
            ...result,
            status: 'error',
            error: batchResult.error || 'Failed'
          }
        }
      }))
    } catch (error: any) {
      console.error('[Bulk List] Batch failed:', error)

      // Mark all as error
      setResults(prev => prev.map(r => ({
        ...r,
        status: 'error',
        error: error.message || 'Batch creation failed'
      })))
    }

    setLoading(false)

    // If all succeeded, close after 2 seconds
    const allSuccess = initialResults.every((_, idx) => {
      const result = results[idx]
      return result?.status === 'success'
    })

    if (allSuccess) {
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 2000)
    }
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-elev-2 via-elev-2 to-accent/5 backdrop-blur-md shadow-2xl border-2 border-accent/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-accent/20 border border-accent/40">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <span className="font-bold text-accent">
              Bulk List on StockX
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats - Colorful Cards */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl border-2 border-accent/40 shadow-lg shadow-accent/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/30">
                <Check className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm font-semibold text-fg">{listableItems.length} items ready to list</span>
            </div>
            <Badge variant="outline" className="bg-accent text-white border-accent px-3 py-1 font-bold">
              {listableItems.length}
            </Badge>
          </div>

          {unmappedCount > 0 && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-amber-500/20 to-amber-500/10 rounded-xl border-2 border-amber-500/50 shadow-lg shadow-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/30">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-sm font-semibold text-fg">{unmappedCount} items not mapped</span>
              </div>
              <Badge variant="outline" className="bg-amber-500 text-white border-amber-500 px-3 py-1 font-bold">
                {unmappedCount}
              </Badge>
            </div>
          )}

          {alreadyListedCount > 0 && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border-2 border-blue-500/50 shadow-lg shadow-blue-500/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/30">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-fg">{alreadyListedCount} items already listed</span>
              </div>
              <Badge variant="outline" className="bg-blue-500 text-white border-blue-500 px-3 py-1 font-bold">
                {alreadyListedCount}
              </Badge>
            </div>
          )}
        </div>

        {/* Item Cards */}
        {listableItems.length > 0 && !loading && results.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
              {listableItems.map(item => {
                const currency = item.market?.currency || 'GBP'
                const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'

                // Use data from stockx object (preferred) or fallback to market/instantSell
                const highestBid = item.stockx?.highestBid || item.instantSell?.gross || null
                const lowestAsk = item.stockx?.lowestAsk || item.market?.lowestAsk || null
                const hasMarketData = highestBid || lowestAsk

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg hover:shadow-xl hover:border-accent/40 transition-all duration-200 space-y-4"
                  >
                    {/* Product Header with Image */}
                    <div className="flex items-start gap-4">
                      {/* Product Image - Alias → StockX → Inventory priority */}
                      {(item.alias_image_url || item.image?.url || item.stockx_image_url || item.image?.src || item.image_url) && (
                        <div className="flex-shrink-0">
                          <img
                            src={item.alias_image_url || item.image?.url || item.stockx_image_url || item.image?.src || item.image_url}
                            alt={item.image?.alt || (item.model?.trim().toLowerCase().startsWith(item.brand?.toLowerCase()) ? item.model.trim() : `${item.brand} ${item.model}`.trim())}
                            className="w-20 h-20 object-cover rounded-lg border-2 border-border shadow-md"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-fg truncate">
                          {item.model?.trim().toLowerCase().startsWith(item.brand?.toLowerCase())
                            ? item.model.trim()
                            : `${item.brand} ${item.model}`.trim()
                          }
                        </h3>
                        <p className="text-sm text-muted truncate mt-0.5">{item.colorway}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-dim font-mono bg-soft px-2 py-1 rounded border border-border">{item.sku}</span>
                          <span className="text-xs font-medium text-muted">Size {item.size_uk} UK</span>
                        </div>
                      </div>
                    </div>

                    {/* Market Data - Colorful Stats */}
                    {hasMarketData && (
                      <div className="flex items-center gap-3 flex-wrap">
                        {highestBid && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 border border-emerald-500/40">
                            <span className="text-xs text-muted font-medium">Highest Bid:</span>
                            <span className="text-sm font-bold text-emerald-400">
                              {symbol}{highestBid.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {lowestAsk && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-500/10 border border-red-500/40">
                            <span className="text-xs text-muted font-medium">Lowest Ask:</span>
                            <span className="text-sm font-bold text-red-400">
                              {symbol}{lowestAsk.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price Input */}
                    <div className="space-y-2">
                      <Label htmlFor={`price-${item.id}`} className="text-xs font-bold text-fg uppercase tracking-wide">
                        Your Ask Price ({symbol})
                      </Label>
                      <Input
                        id={`price-${item.id}`}
                        type="number"
                        step="0.01"
                        placeholder={`e.g., ${lowestAsk ? lowestAsk.toFixed(2) : '150.00'}`}
                        value={itemPrices[item.id] || ''}
                        onChange={(e) => setItemPrice(item.id, e.target.value)}
                        className="bg-elev-2 border-2 border-border focus:border-accent text-fg h-11 text-base font-medium shadow-sm"
                      />
                    </div>

                    {/* Quick Action Buttons - Vibrant Colors */}
                    <div className="flex gap-2 flex-wrap">
                      {highestBid && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuickPrice(item.id, 'bid')}
                          className="text-xs h-8 font-semibold bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 hover:border-emerald-500 transition-all"
                        >
                          💰 Sell @ Bid ({symbol}{highestBid.toFixed(2)})
                        </Button>
                      )}
                      {lowestAsk && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setQuickPrice(item.id, 'ask-5')}
                            className="text-xs h-8 font-semibold bg-gradient-to-r from-accent/20 to-accent/10 border-2 border-accent/50 text-accent hover:bg-accent/30 hover:border-accent transition-all"
                          >
                            🔥 -5% ({symbol}{(lowestAsk * 0.95).toFixed(2)})
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setQuickPrice(item.id, 'ask')}
                            className="text-xs h-8 font-semibold bg-gradient-to-r from-blue-500/20 to-blue-500/10 border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500 transition-all"
                          >
                            ⚡ Match Ask ({symbol}{lowestAsk.toFixed(2)})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Submit Button - Bold Accent */}
            <Button
              onClick={handleSubmit}
              disabled={loading || Object.keys(itemPrices).length === 0}
              className="w-full h-12 bg-[#00FF94] hover:bg-[#00E085] text-black font-bold text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
            >
              <TrendingUp className="h-5 w-5 mr-2" />
              List {Object.keys(itemPrices).length} Item{Object.keys(itemPrices).length !== 1 ? 's' : ''} on StockX
            </Button>
          </div>
        )}

        {/* Results - Colorful Progress */}
        {results.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl border-2 border-accent/30">
              <h3 className="text-sm font-bold text-fg uppercase tracking-wide">Progress</h3>
              <div className="flex items-center gap-3 text-sm font-semibold">
                <span className="text-emerald-400">{successCount} ✓</span>
                {errorCount > 0 && (
                  <span className="text-red-400">{errorCount} ✗</span>
                )}
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              {results.map((result, idx) => (
                <div
                  key={result.itemId}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                    result.status === 'success' && 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10',
                    result.status === 'error' && 'bg-gradient-to-r from-red-500/20 to-red-500/10 border-red-500/50 shadow-lg shadow-red-500/10',
                    result.status === 'processing' && 'bg-gradient-to-r from-blue-500/20 to-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10 animate-pulse',
                    result.status === 'pending' && 'bg-elev-1 border-border'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fg truncate">
                      {result.brand} {result.model}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Size {result.size_uk} UK
                    </p>
                    {result.error && (
                      <p className="text-xs text-red-400 mt-1 font-medium">{result.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {result.status === 'pending' && (
                      <div className="h-5 w-5 rounded-full bg-border" />
                    )}
                    {result.status === 'processing' && (
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    )}
                    {result.status === 'success' && (
                      <div className="p-1 rounded-full bg-emerald-500/20">
                        <Check className="h-4 w-4 text-emerald-400" />
                      </div>
                    )}
                    {result.status === 'error' && (
                      <div className="p-1 rounded-full bg-red-500/20">
                        <X className="h-4 w-4 text-red-400" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!loading && (
              <Button
                onClick={() => {
                  onSuccess()
                  handleClose()
                }}
                variant="outline"
                className="w-full h-11 border-2 border-accent text-accent hover:bg-accent hover:text-white font-semibold transition-all"
              >
                Close
              </Button>
            )}
          </div>
        )}

        {/* No listable items */}
        {listableItems.length === 0 && (
          <div className="py-12 text-center">
            <div className="p-4 rounded-full bg-muted/10 w-fit mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-muted mx-auto" />
            </div>
            <p className="text-sm text-muted max-w-md mx-auto">
              No items are ready to list. Items must be mapped to StockX and not already listed.
            </p>
            <Button
              onClick={handleClose}
              variant="outline"
              className="mt-6 border-2 border-accent text-accent hover:bg-accent hover:text-white font-semibold"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
