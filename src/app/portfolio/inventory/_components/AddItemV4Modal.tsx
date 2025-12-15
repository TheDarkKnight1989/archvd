'use client'

/**
 * AddItemV4Modal - Add items to V4 inventory
 *
 * Simplified modal for V4:
 * - SKU search (reuses existing search endpoint)
 * - Size selection
 * - Purchase price/currency
 * - Condition
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Loader2, Search, X, Check } from 'lucide-react'
import { PRESET_PURCHASE_SOURCES } from '@/lib/inventory-v4/types'

// =============================================================================
// TYPES
// =============================================================================

import type { InventoryV4ItemFull } from '@/lib/inventory-v4/types'

interface AddItemV4ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void | Promise<void>
  /** Item to edit or duplicate. If id is present, it's edit mode. If not, it's duplicate mode. */
  editItem?: InventoryV4ItemFull | null
}

interface SearchResult {
  styleId: string
  name: string
  brand: string
  colorway: string | null
  imageUrl: string | null
  stockxProductId: string | null
  stockxUrlKey: string | null
  aliasCatalogId: string | null
  gender: string | null
  productCategory: string | null
  releaseDate: string | null
  retailPrice: number | null
  /** Whether this SKU exists in our V4 style catalog */
  inDatabase: boolean
}

type SizeUnit = 'US' | 'UK' | 'EU'
type Condition = 'new' | 'used' | 'deadstock'
type Currency = 'GBP' | 'USD' | 'EUR'

// =============================================================================
// SIZE OPTIONS
// =============================================================================

const SHOE_SIZES: Record<SizeUnit, string[]> = {
  US: [
    '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5',
    '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '15', '16', '17',
  ],
  UK: [
    '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5',
    '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '14', '15', '16',
  ],
  EU: [
    '36', '36.5', '37', '37.5', '38', '38.5', '39', '40', '40.5', '41', '42',
    '42.5', '43', '44', '44.5', '45', '45.5', '46', '47', '47.5', '48', '49', '50',
  ],
}


// =============================================================================
// COMPONENT
// =============================================================================

export function AddItemV4Modal({ open, onOpenChange, onSuccess, editItem }: AddItemV4ModalProps) {
  // Determine mode: edit (has id) vs duplicate (no id) vs add (no editItem)
  const isEditMode = Boolean(editItem?.id)
  const isDuplicateMode = Boolean(editItem && !editItem.id)
  const { currency: globalCurrency } = useCurrency()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Selected product
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null)

  // Form state
  const [size, setSize] = useState('')
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('US')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>('GBP')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [purchaseSource, setPurchaseSource] = useState<string>('')
  const [condition, setCondition] = useState<Condition>('new')

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Initialize currency from user's preference
  useEffect(() => {
    if (open && globalCurrency) {
      setPurchaseCurrency(globalCurrency as Currency)
      // Auto-set size unit based on currency
      const unitMap: Record<Currency, SizeUnit> = { GBP: 'UK', USD: 'US', EUR: 'EU' }
      setSizeUnit(unitMap[globalCurrency as Currency] || 'US')
    }
  }, [open, globalCurrency])

  // Track whether we're currently pre-filling (to avoid size reset interference)
  const isPrefillingRef = useRef(false)

  // Pre-fill form when editItem is provided (for edit/duplicate)
  useEffect(() => {
    if (open && editItem) {
      // Set flag to prevent size reset effect from clearing our pre-filled size
      isPrefillingRef.current = true

      // Convert InventoryV4ItemFull to SearchResult format for selectedProduct
      const style = editItem.style
      setSelectedProduct({
        styleId: editItem.style_id,
        name: style.name || '',
        brand: style.brand || 'Unknown',
        colorway: style.colorway || null,
        imageUrl: style.primary_image_url || null,
        stockxProductId: style.stockx_product_id || null,
        stockxUrlKey: style.stockx_url_key || null,
        aliasCatalogId: style.alias_catalog_id || null,
        gender: style.gender || null,
        productCategory: style.product_category || null,
        releaseDate: style.release_date || null,
        retailPrice: style.retail_price_cents ? style.retail_price_cents / 100 : null,
        inDatabase: true,
      })

      // Pre-fill form fields from the item - set sizeUnit FIRST, then size
      setSizeUnit((editItem.size_unit || 'US') as SizeUnit)
      // Use setTimeout to ensure sizeUnit effect has run before we set size
      setTimeout(() => {
        setSize(editItem.size)
        isPrefillingRef.current = false
      }, 0)

      // purchase_price is in major units (e.g., 120.50), not cents
      setPurchasePrice(editItem.purchase_price != null ? String(editItem.purchase_price) : '')
      setPurchaseCurrency((editItem.purchase_currency || 'GBP') as Currency)
      setPurchaseDate(editItem.purchase_date || new Date().toISOString().split('T')[0])
      setPurchaseSource(editItem.purchase_source || '')
      setCondition((editItem.condition || 'new') as Condition)
    }
  }, [open, editItem])

  // Reset size when sizeUnit changes (but not during pre-fill)
  useEffect(() => {
    if (!isPrefillingRef.current) {
      setSize('')
    }
  }, [sizeUnit])

  // Reset form when modal closes, focus input when opens
  useEffect(() => {
    let focusTimeout: ReturnType<typeof setTimeout> | null = null

    if (open) {
      // Focus search input on open (slight delay for dialog animation)
      focusTimeout = setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      // Abort any in-flight requests
      abortControllerRef.current?.abort()
      abortControllerRef.current = null

      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
      setSelectedProduct(null)
      setSize('')
      setPurchasePrice('')
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setPurchaseSource('')
      setCondition('new')
      setError(null)
      setSuccess(false)
    }

    return () => {
      if (focusTimeout) clearTimeout(focusTimeout)
    }
  }, [open])

  // Handle Escape key to close dropdown (FIX #2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showResults) {
        e.preventDefault()
        setShowResults(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, showResults])

  // Search products with AbortController (FIX #3)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const searchProducts = async () => {
      // Abort previous request
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsSearching(true)
      setShowResults(true)

      try {
        const response = await fetch(
          `/api/add-item/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          setSearchResults([])
          return
        }

        const data = await response.json()

        // Map results to our format
        // Note: inDatabase comes from API if available, defaults to false for external results
        const results: SearchResult[] = (data.priceable || data.results || []).map(
          (row: any) => ({
            styleId: row.styleId || row.sku,
            name: row.title || row.name,
            brand: row.brand || 'Unknown',
            colorway: row.colorway || null,
            imageUrl: row.imageUrl || row.image || null,
            stockxProductId: row.stockxProductId || null,
            stockxUrlKey: row.stockxUrlKey || null,
            aliasCatalogId: row.aliasCatalogId || null,
            gender: row.gender || null,
            productCategory: row.category || row.productCategory || null,
            releaseDate: row.releaseDate || null,
            retailPrice: row.retailPrice || null,
            inDatabase: row.inDatabase ?? false,
          })
        )

        setSearchResults(results)
      } catch (err: any) {
        // Ignore abort errors
        if (err.name === 'AbortError') return
        console.error('[AddItemV4] Search failed:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => {
      clearTimeout(debounce)
      abortControllerRef.current?.abort()
    }
  }, [searchQuery])

  // Handle product selection
  const handleSelectProduct = useCallback((product: SearchResult) => {
    // Abort any in-flight search to prevent flicker
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    setSelectedProduct(product)
    setSearchQuery('')
    setShowResults(false)
    setSearchResults([])
  }, [])

  // Handle clearing selected product (FIX: reset form fields)
  const handleClearProduct = useCallback(() => {
    setSelectedProduct(null)
    setSize('')
    setPurchasePrice('')
  }, [])

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError('Please select a product')
      return
    }

    if (!size) {
      setError('Please select a size')
      return
    }

    // Guard against NaN purchasePrice
    const parsedPrice = purchasePrice.trim() === '' ? null : Number(purchasePrice)
    if (parsedPrice !== null && !Number.isFinite(parsedPrice)) {
      setError('Purchase price must be a valid number')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let response: Response
      let data: any

      if (isEditMode && editItem?.id) {
        // EDIT MODE: PATCH existing item
        response = await fetch('/api/inventory-v4/add-item', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editItem.id,
            size,
            sizeUnit,
            purchasePrice: parsedPrice,
            purchaseCurrency,
            purchaseDate: purchaseDate || null,
            purchaseSource: purchaseSource || null,
            condition,
          }),
        })

        data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to update item')
        }
      } else {
        // ADD/DUPLICATE MODE: POST new item
        const normalizedStyleId = selectedProduct.styleId.trim().toUpperCase()
        const rp = Number(selectedProduct.retailPrice)
        const retailPriceCents = Number.isFinite(rp) && rp > 0 ? Math.round(rp * 100) : null

        response = await fetch('/api/inventory-v4/add-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            styleId: normalizedStyleId,
            size,
            sizeUnit,
            purchasePrice: parsedPrice,
            purchaseCurrency,
            purchaseDate: purchaseDate || null,
            purchaseSource: purchaseSource || null,
            condition,
            styleCatalog: {
              brand: selectedProduct.brand,
              name: selectedProduct.name,
              colorway: selectedProduct.colorway,
              primaryImageUrl: selectedProduct.imageUrl,
              stockxProductId: selectedProduct.stockxProductId,
              stockxUrlKey: selectedProduct.stockxUrlKey,
              aliasCatalogId: selectedProduct.aliasCatalogId,
              gender: selectedProduct.gender,
              productCategory: selectedProduct.productCategory,
              releaseDate: selectedProduct.releaseDate,
              retailPriceCents,
            },
          }),
        })

        data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to add item')
        }
      }

      setSuccess(true)
      onSuccess?.()

      // Close after showing success
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (err: any) {
      console.error('[AddItemV4] Submit failed:', err)
      setError(err.message || 'Failed to add item')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle click outside search dropdown (FIX #2)
  const handleSearchBlur = useCallback(() => {
    // Delay to allow click on result
    setTimeout(() => {
      setShowResults(false)
    }, 200)
  }, [])

  // Prevent closing while submitting
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (isSubmitting) return
      onOpenChange(next)
    },
    [isSubmitting, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#111111] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditMode ? 'Edit Item' : isDuplicateMode ? 'Duplicate Item' : 'Add to V4 Inventory'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-white font-medium">
                {isEditMode ? 'Item updated successfully!' : 'Item added successfully!'}
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form (hidden during success) */}
          {!success && (
            <>
              {/* Product Search */}
              <div className="space-y-2">
                <Label className="text-white/70 text-xs uppercase tracking-wide">
                  Product *
                </Label>

                {selectedProduct ? (
                  // Selected product display
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
                      {selectedProduct.imageUrl && (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-14 h-14 rounded-md object-cover bg-black"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {selectedProduct.name}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {selectedProduct.brand} • {selectedProduct.styleId}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearProduct}
                        className="text-white/50 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* New to ARCHVD notice */}
                    {!selectedProduct.inDatabase && (
                      <div className="flex items-start gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="h-4 w-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-blue-400 text-[10px] font-bold">+</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-400">New to ARCHVD</p>
                          <p className="text-[11px] text-white/50 mt-0.5">
                            Market data will sync automatically after adding.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Search input
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowResults(true)
                      }}
                      onBlur={handleSearchBlur}
                      placeholder="Search by SKU or name..."
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />

                    {/* Search results dropdown */}
                    {showResults && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg max-h-64 overflow-y-auto z-[60]">
                        {isSearching ? (
                          <div className="p-4 flex items-center justify-center text-white/50">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-4 text-center text-white/50 text-sm">
                            No products found
                          </div>
                        ) : (
                          searchResults.map((product) => (
                            <button
                              key={product.styleId}
                              onMouseDown={(e) => {
                                // Prevent blur from firing before click
                                e.preventDefault()
                                handleSelectProduct(product)
                              }}
                              className="w-full p-3 flex items-start gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left"
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-md object-cover bg-black flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-white/5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/40 font-mono">
                                  {product.styleId}
                                </p>
                                <p className="text-sm text-white font-medium truncate">
                                  {product.brand}
                                </p>
                                <p className="text-sm text-white/70 truncate">
                                  {product.name}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Size Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs uppercase tracking-wide">
                    Size *
                  </Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      {SHOE_SIZES[sizeUnit].map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          className="text-white hover:bg-white/10"
                        >
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70 text-xs uppercase tracking-wide">
                    Size System
                  </Label>
                  <Select value={sizeUnit} onValueChange={(v) => setSizeUnit(v as SizeUnit)}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/10">
                      <SelectItem value="US" className="text-white hover:bg-white/10">
                        US
                      </SelectItem>
                      <SelectItem value="UK" className="text-white hover:bg-white/10">
                        UK
                      </SelectItem>
                      <SelectItem value="EU" className="text-white hover:bg-white/10">
                        EU
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-xs uppercase tracking-wide">
                    Purchase Price
                  </Label>
                  <div className="flex">
                    <Select
                      value={purchaseCurrency}
                      onValueChange={(v) => setPurchaseCurrency(v as Currency)}
                    >
                      <SelectTrigger className="w-24 rounded-r-none bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="£ GBP" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-white/10">
                        <SelectItem value="GBP" className="text-white hover:bg-white/10">
                          £ GBP
                        </SelectItem>
                        <SelectItem value="USD" className="text-white hover:bg-white/10">
                          $ USD
                        </SelectItem>
                        <SelectItem value="EUR" className="text-white hover:bg-white/10">
                          € EUR
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="rounded-l-none bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70 text-xs uppercase tracking-wide">
                    Purchase Date
                  </Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Source */}
              <div className="space-y-2">
                <Label className="text-white/70 text-xs uppercase tracking-wide">
                  Source
                </Label>
                <Select value={purchaseSource} onValueChange={setPurchaseSource}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Where did you buy it?" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/10 max-h-64">
                    {PRESET_PURCHASE_SOURCES.map((source) => (
                      <SelectItem
                        key={source}
                        value={source}
                        className="text-white hover:bg-white/10"
                      >
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label className="text-white/70 text-xs uppercase tracking-wide">
                  Condition
                </Label>
                <div className="flex gap-2">
                  {(['new', 'used', 'deadstock'] as Condition[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize',
                        condition === c
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                      )}
                    >
                      {c === 'deadstock' ? 'DS' : c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedProduct || !size}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : isDuplicateMode ? 'Add Duplicate' : 'Add Item'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
