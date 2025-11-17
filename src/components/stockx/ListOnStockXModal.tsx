'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useListingOperations, calculateListingFees } from '@/hooks/useStockxListings'
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

interface StockXProduct {
  id: string
  styleId: string
  title: string
  brand: string
  colorway?: string
  imageUrl?: string
  variants?: Array<{
    id: string
    size: string
    gtins?: string[]
  }>
}

interface ListOnStockXModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  item: {
    id: string
    sku: string
    brand?: string
    model?: string
    size_uk?: string
    purchase_price: number
    tax?: number
    shipping?: number
    market_price?: number
    market_last_sale?: number
    market_lowest_ask?: number
    market_highest_bid?: number
  }
}

type ModalStep = 'checking' | 'search' | 'select_variant' | 'mapping' | 'listing'

export function ListOnStockXModal({ open, onClose, onSuccess, item }: ListOnStockXModalProps) {
  const { createListing, loading: listingLoading, error: listingError } = useListingOperations()

  // Modal state
  const [step, setStep] = useState<ModalStep>('checking')
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<StockXProduct[]>([])

  // Selection state
  const [selectedProduct, setSelectedProduct] = useState<StockXProduct | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [mapping, setMapping] = useState(false)

  // Market data state
  const [marketData, setMarketData] = useState<{
    lastSale?: number
    lowestAsk?: number
    highestBid?: number
  }>({
    lastSale: item.market_last_sale,
    lowestAsk: item.market_lowest_ask,
    highestBid: item.market_highest_bid,
  })

  // Listing form state
  const [askPrice, setAskPrice] = useState('')
  const [expiryDays, setExpiryDays] = useState('90')

  const invested = (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0)
  const suggestedPrice = marketData.lowestAsk
    ? Math.round((marketData.lowestAsk - 5) * 100) / 100
    : Math.round(invested * 1.3)

  useEffect(() => {
    if (open) {
      checkMapping()
      setSearchQuery(`${item.brand} ${item.model} ${item.sku}`.trim())
    }
  }, [open])

  useEffect(() => {
    if (step === 'listing') {
      setAskPrice(suggestedPrice.toString())
    }
  }, [step, suggestedPrice])

  // Check if item already has StockX mapping
  const checkMapping = async () => {
    try {
      setStep('checking')
      setError(null)

      const response = await fetch(`/api/items/${item.id}/stockx-mapping`)

      if (response.ok) {
        const data = await response.json()
        if (data.mapped) {
          // Item is already mapped, go straight to listing
          setStep('listing')
        } else {
          // No mapping, show search
          setStep('search')
        }
      } else {
        // Assume no mapping if endpoint doesn't exist
        setStep('search')
      }
    } catch (err) {
      console.error('Error checking mapping:', err)
      // On error, assume no mapping and show search
      setStep('search')
    }
  }

  // Search for StockX products
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      setSearching(true)
      setError(null)

      const response = await fetch(
        `/api/stockx/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to search products')
      }

      const data = await response.json()
      setSearchResults(data.results || [])

      if (data.results.length === 0) {
        setError('No products found. Try a different search term.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search products')
    } finally {
      setSearching(false)
    }
  }

  // Select a product and fetch its variants
  const handleSelectProduct = async (product: StockXProduct) => {
    try {
      setError(null)
      setSelectedProduct(product)

      // Fetch product variants
      const response = await fetch(`/api/stockx/products/${product.id}/variants`)

      if (!response.ok) {
        throw new Error('Failed to fetch product variants')
      }

      const data = await response.json()
      setSelectedProduct({ ...product, variants: data.variants })
      setStep('select_variant')
    } catch (err: any) {
      setError(err.message || 'Failed to load product variants')
    }
  }

  // Create the StockX mapping
  const handleCreateMapping = async () => {
    if (!selectedProduct || !selectedVariantId) return

    try {
      setMapping(true)
      setError(null)

      const response = await fetch('/api/items/create-stockx-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          stockxProductId: selectedProduct.id,
          stockxVariantId: selectedVariantId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create mapping')
      }

      const data = await response.json()

      // Update market data if available
      if (data.marketData) {
        setMarketData({
          lastSale: data.marketData.lastSale,
          lowestAsk: data.marketData.lowestAsk,
          highestBid: data.marketData.highestBid,
        })
      }

      setStep('listing')
    } catch (err: any) {
      setError(err.message || 'Failed to create mapping')
    } finally {
      setMapping(false)
    }
  }

  // Submit listing
  const handleSubmit = async () => {
    try {
      await createListing({
        inventoryItemId: item.id,
        askPrice: parseFloat(askPrice),
        expiryDays: parseInt(expiryDays),
      })
      onSuccess()
      onClose()
    } catch (err) {
      // Error handled by hook
    }
  }

  const fees = askPrice ? calculateListingFees(parseFloat(askPrice)) : null
  const profit = fees ? fees.netPayout - invested : 0

  // Convert UK size to US size for matching
  const ukToUs = (ukSize: string) => {
    const size = parseFloat(ukSize)
    return isNaN(size) ? ukSize : (size + 1).toString()
  }

  const usSize = item.size_uk ? ukToUs(item.size_uk) : ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List on StockX</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="border-b pb-4">
            <p className="font-medium">{item.brand} {item.model}</p>
            <p className="text-sm text-muted-foreground">{item.sku} · UK{item.size_uk}</p>
          </div>

          {/* Step: Checking */}
          {step === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Checking StockX mapping...</p>
            </div>
          )}

          {/* Step: Search */}
          {step === 'search' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Product not mapped to StockX</p>
                    <p className="text-xs mt-1">Search for this product on StockX to create the mapping.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Search StockX</Label>
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by SKU, style ID, or name"
                  />
                  <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Product</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-accent hover:bg-accent/5 transition-colors text-left"
                      >
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.styleId} · {product.colorway}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Select Variant */}
          {step === 'select_variant' && selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedProduct.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProduct.styleId} · {selectedProduct.colorway}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Size (US {usSize} / UK {item.size_uk})</Label>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {selectedProduct.variants?.map((variant) => {
                    const isRecommended =
                      variant.size === usSize ||
                      variant.size === `M ${usSize}` ||
                      variant.size === `US ${usSize}`

                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          selectedVariantId === variant.id
                            ? 'border-accent bg-accent text-accent-foreground'
                            : isRecommended
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'hover:border-accent/50'
                        }`}
                      >
                        <div className="text-sm font-medium">{variant.size}</div>
                        {isRecommended && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            Recommended
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Green border indicates recommended size based on your UK size
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep('search')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleCreateMapping}
                  disabled={!selectedVariantId || mapping}
                  className="flex-1"
                >
                  {mapping ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating Mapping...
                    </>
                  ) : (
                    'Create Mapping & Continue'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Listing Form */}
          {step === 'listing' && (
            <>
              {/* Market Data */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Last Sale</p>
                  <p className="font-medium">{marketData.lastSale ? formatCurrency(marketData.lastSale, 'GBP') : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lowest Ask</p>
                  <p className="font-medium">{marketData.lowestAsk ? formatCurrency(marketData.lowestAsk, 'GBP') : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Highest Bid</p>
                  <p className="font-medium">{marketData.highestBid ? formatCurrency(marketData.highestBid, 'GBP') : '—'}</p>
                </div>
              </div>

              {/* Ask Price Input */}
              <div className="space-y-2">
                <Label htmlFor="askPrice">Ask Price (GBP)</Label>
                <Input
                  id="askPrice"
                  type="number"
                  step="0.01"
                  value={askPrice}
                  onChange={(e) => setAskPrice(e.target.value)}
                  placeholder="Enter ask price"
                />
                {marketData.lowestAsk && (
                  <p className="text-xs text-muted-foreground">
                    Suggested: {formatCurrency(suggestedPrice, 'GBP')} (Lowest Ask - £5)
                  </p>
                )}
              </div>

              {/* Expiry */}
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry (days)</Label>
                <Input
                  id="expiry"
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                />
              </div>

              {/* Fee Breakdown */}
              {fees && (
                <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                  <h3 className="font-medium text-sm">Fee Breakdown</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ask Price</span>
                      <span className="font-medium">{formatCurrency(fees.askPrice, 'GBP')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction Fee (9%)</span>
                      <span className="text-red-500">-{formatCurrency(fees.transactionFee, 'GBP')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Fee (3%)</span>
                      <span className="text-red-500">-{formatCurrency(fees.processingFee, 'GBP')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Net Payout</span>
                      <span className="font-medium">{formatCurrency(fees.netPayout, 'GBP')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost Basis</span>
                      <span>{formatCurrency(invested, 'GBP')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Profit</span>
                      <span className={profit > 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                        {formatCurrency(profit, 'GBP')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={onClose} disabled={listingLoading} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={listingLoading || !askPrice || parseFloat(askPrice) <= 0}
                  className="flex-1"
                >
                  {listingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Listing...
                    </>
                  ) : (
                    'List on StockX'
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Error */}
          {(error || listingError) && (
            <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              {error || listingError}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
