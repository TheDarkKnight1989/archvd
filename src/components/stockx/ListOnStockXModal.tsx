'use client'

/**
 * Enhanced StockX Listing Modal
 *
 * Comprehensive listing creation modal with:
 * - Market Data tab: Price trends, stats, and insights
 * - Create Listing tab: Form with automation rules and fee breakdown
 *
 * Supports both CREATE (new listing) and REPRICE (update existing) modes
 * based on whether item.existingListing is defined.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Plus, Check, X, RefreshCw, AlertTriangle } from 'lucide-react'
import { MarketDataTab } from './tabs/MarketDataTab'
import { CreateListingTab, type ListingFormData } from './tabs/CreateListingTab'
import type {
  StockXListingModalItem,
  ExistingStockXListing,
} from '@/lib/inventory-v4/stockx-listing-adapter'
import { isRepriceMode, getListingCTAText, canListOnStockX } from '@/lib/inventory-v4/stockx-listing-adapter'
import type { InventoryV4Listing } from '@/lib/inventory-v4/types'

// =============================================================================
// TYPES
// =============================================================================

interface ListOnStockXModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Accepts either typed V4 item or legacy V3 item (auto-converted) */
  item: StockXListingModalItem | LegacyItemShape
}

/**
 * Type guard to check if item is already a StockXListingModalItem
 */
function isTypedModalItem(
  item: StockXListingModalItem | LegacyItemShape
): item is StockXListingModalItem {
  // V4 items have user_id and hasStockxMapping, V3 items don't
  return 'hasStockxMapping' in item && 'stockxCurrency' in item
}

/**
 * Legacy item adapter - transforms old item shape to StockXListingModalItem.
 * Use this when calling from V3 code that hasn't been migrated yet.
 */
export interface LegacyItemShape {
  id: string
  sku: string
  brand?: string
  model?: string
  colorway?: string
  size_uk?: string
  size?: string
  alias_image_url?: string
  image_url?: string
  image?: { url?: string; alt?: string }
  market_currency?: string
  market?: {
    price?: number
    highestBid?: number
    currency?: string
  }
  stockx?: {
    mapped?: boolean
    productId?: string
    variantId?: string
    lowestAsk?: number
    highestBid?: number
    lastSale?: number
    salesLast72h?: number
    listingId?: string
    listingStatus?: string
  }
  instantSell?: { gross: number }
  invested?: number
  avgCost?: number
  /** V4: Source of truth for StockX listing state (from adapter) */
  _v4StockxListing?: InventoryV4Listing | null
}

/**
 * Convert legacy item shape to typed modal item.
 * Only use this for backwards compatibility with V3 callers.
 */
export function legacyItemToModalItem(
  legacy: LegacyItemShape
): StockXListingModalItem {
  const currency = (legacy.market_currency as 'GBP' | 'USD' | 'EUR') || 'GBP'

  // V4: Prefer _v4StockxListing (source of truth from adapter)
  const v4Listing = legacy._v4StockxListing
  const isListed = v4Listing
    ? v4Listing.status === 'active' || v4Listing.status === 'paused'
    : !!(
        legacy.stockx?.listingId &&
        (legacy.stockx?.listingStatus === 'ACTIVE' ||
          legacy.stockx?.listingStatus === 'PENDING')
      )

  // V4: Prefer V4 listing data when available
  // Map V4 status to ExistingStockXListing status (only active/paused allowed)
  const listingStatus: 'active' | 'paused' =
    v4Listing?.status === 'paused' ? 'paused' : 'active'

  const existingListing: ExistingStockXListing | undefined = isListed
    ? {
        id: v4Listing?.id ?? '', // V4 internal listing ID
        external_listing_id: v4Listing?.external_listing_id ?? legacy.stockx?.listingId ?? '',
        listed_price: v4Listing?.listed_price ?? legacy.stockx?.lowestAsk ?? 0,
        listed_currency: (v4Listing?.listed_currency as 'GBP' | 'USD' | 'EUR') ?? currency,
        status: listingStatus,
      }
    : undefined

  return {
    id: legacy.id,
    user_id: '', // Will be filled by API from auth
    sku: legacy.sku,
    brand: legacy.brand ?? 'Unknown',
    name: legacy.model ?? legacy.sku,
    colorway: legacy.colorway ?? null,
    imageUrl:
      legacy.alias_image_url ??
      legacy.image?.url ??
      legacy.image_url ??
      null,
    size: legacy.size_uk ?? legacy.size ?? '',
    sizeUnit: legacy.size_uk ? 'UK' : 'US',
    purchasePrice: legacy.invested ?? legacy.avgCost ?? null,
    purchaseCurrency: currency,
    lowestAsk: legacy.stockx?.lowestAsk ?? legacy.market?.price ?? null,
    highestBid:
      legacy.stockx?.highestBid ??
      legacy.market?.highestBid ??
      legacy.instantSell?.gross ??
      null,
    lastSale: legacy.stockx?.lastSale ?? null,
    salesLast72h: legacy.stockx?.salesLast72h ?? null,
    stockxCurrency: currency,
    displayCurrency: currency,
    // V4: Only require productId for mapping check. variantId is looked up at listing time
    // from inventory_market_links or V4 variants table based on item size
    hasStockxMapping: !!(
      legacy.stockx?.mapped &&
      legacy.stockx?.productId
    ),
    stockxProductId: legacy.stockx?.productId ?? null,
    stockxVariantId: legacy.stockx?.variantId ?? null,
    existingListing,
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ListOnStockXModal({
  open,
  onClose,
  onSuccess,
  item: rawItem,
}: ListOnStockXModalProps) {
  const [activeTab, setActiveTab] = useState<'market' | 'create'>('market')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Normalize item: convert legacy V3 items to typed V4 shape
  const item: StockXListingModalItem = isTypedModalItem(rawItem)
    ? rawItem
    : legacyItemToModalItem(rawItem)

  // Determine mode: CREATE or REPRICE
  const repriceMode = isRepriceMode(item)
  const { canList, reason: cannotListReason } = canListOnStockX(item)

  // Currency for display and API
  const currency = item.stockxCurrency

  const handleClose = () => {
    if (loading || success) return
    setError(null)
    setWarning(null)
    setSuccess(false)
    setActiveTab('market')
    onClose()
  }

  const handleSubmit = async (formData: ListingFormData) => {
    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, 45000) // 45 second client-side timeout

      const response = await fetch('/api/stockx/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: item.id,
          askPrice: formData.askPrice,
          currencyCode: currency,
          // Note: Automation rules are captured but not yet active
          // These will be used in future iterations
          metadata: {
            matchLowestAsk: formData.matchLowestAsk,
            instantSell: formData.instantSell,
            autoLowerWeekly: formData.autoLowerWeekly,
            autoMatchPercent: formData.autoMatchPercent,
            minProfitMargin: formData.minProfitMargin,
            minPriceFloor: formData.minPriceFloor,
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      console.log('[List on StockX] API response:', { status: response.status, data })

      if (!response.ok) {
        if (data.code === 'NO_MAPPING') {
          throw new Error(
            'This item is not linked to StockX. Please map it first in the StockX Mappings page.'
          )
        } else if (data.code === 'INCOMPLETE_MAPPING') {
          throw new Error(
            'StockX variant data not synced. Go to the Market page for this product and click "Sync StockX" to refresh.'
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

      // Check for partial-write warning (StockX succeeded but local DB failed)
      if (data.warning === 'LISTING_CREATED_BUT_NOT_SAVED') {
        setWarning(data.warningMessage || 'Created on StockX but local save failed. Please refresh.')
        toast.warning('Listing created but local save failed. Please refresh.')
      } else {
        // Show success toast
        const priceFormatted = currency === 'GBP' ? `£${formData.askPrice.toLocaleString()}`
          : currency === 'EUR' ? `€${formData.askPrice.toLocaleString()}`
          : `$${formData.askPrice.toLocaleString()}`
        toast.success(
          repriceMode
            ? `Price updated to ${priceFormatted}`
            : `Listed on StockX at ${priceFormatted}`
        )
      }

      setSuccess(true)

      setTimeout(() => {
        onSuccess() // Triggers refetch to sync badges
        handleClose()
      }, data.warning ? 2500 : 1500) // Extra time to read warning
    } catch (err: unknown) {
      console.error('[List on StockX] Error:', err)

      // Handle timeout specifically
      let errorMsg: string
      if (err instanceof Error && err.name === 'AbortError') {
        errorMsg = 'Request timed out after 45 seconds. StockX may be slow. Please try again.'
      } else {
        errorMsg = err instanceof Error ? err.message : 'Unknown error'
      }
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  // Build display name (avoid "Nike Nike Air..." duplication)
  const displayName = item.name
    .trim()
    .toLowerCase()
    .startsWith(item.brand.toLowerCase())
    ? item.name.trim()
    : `${item.brand} ${item.name}`.trim()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-elev-2 via-elev-2 to-accent/5 backdrop-blur-md shadow-2xl border-2 border-accent/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-accent/20 border border-accent/40">
              {repriceMode ? (
                <RefreshCw className="h-5 w-5 text-accent" />
              ) : (
                <TrendingUp className="h-5 w-5 text-accent" />
              )}
            </div>
            <span className="font-bold text-accent">
              {repriceMode ? 'Update StockX Price' : 'List on StockX'}
            </span>
          </DialogTitle>

          {/* Item Info - Enhanced Card */}
          <div className="text-left pt-3">
            <div className="p-5 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg hover:shadow-xl hover:border-accent/40 transition-all duration-200">
              <div className="flex gap-4">
                {/* Product Image */}
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={displayName}
                    className="w-20 h-20 rounded-lg object-cover bg-elev-2 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-fg">{displayName}</div>
                  {item.colorway && (
                    <div className="text-sm text-muted mt-1">{item.colorway}</div>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-dim font-mono bg-soft px-2 py-1 rounded border border-border">
                      {item.sku}
                    </span>
                    <span className="text-xs font-medium text-muted">
                      Size {item.size} {item.sizeUnit}
                    </span>
                  </div>

                  {/* Reprice mode indicator */}
                  {repriceMode && item.existingListing && (
                    <div className="mt-2 text-xs text-muted">
                      Current price:{' '}
                      <span className="font-semibold text-accent">
                        {item.existingListing.listed_currency === 'GBP' ? '£' : item.existingListing.listed_currency === 'EUR' ? '€' : '$'}
                        {item.existingListing.listed_price.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Cannot list warning */}
        {!canList && cannotListReason && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-amber-400 bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-2 border-amber-500/50 rounded-xl shadow-lg shadow-amber-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20">
              <X className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>{cannotListReason}</span>
          </div>
        )}

        {/* Error Message - Vibrant Red */}
        {error && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-red-400 bg-gradient-to-r from-red-500/20 to-red-500/10 border-2 border-red-500/50 rounded-xl shadow-lg shadow-red-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-red-500/20">
              <X className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>{error}</span>
          </div>
        )}

        {/* Warning Message - Yellow (partial success) */}
        {warning && success && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-amber-400 bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-2 border-amber-500/50 rounded-xl shadow-lg shadow-amber-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>{warning}</span>
          </div>
        )}

        {/* Success Message - Vibrant Green */}
        {success && !warning && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-emerald-400 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/50 rounded-xl shadow-lg shadow-emerald-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20">
              <Check className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>
              {repriceMode ? 'Price updated successfully!' : 'Listing created successfully!'}
            </span>
          </div>
        )}

        {/* Tabs - Enhanced Styling */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'market' | 'create')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-soft/50 to-soft/30 border-2 border-border p-1 rounded-lg shadow-sm">
            <TabsTrigger
              value="market"
              className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-accent/20 data-[state=active]:to-accent/10 data-[state=active]:border-2 data-[state=active]:border-accent/40 data-[state=active]:shadow-lg data-[state=active]:shadow-accent/10 data-[state=active]:text-accent font-semibold transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              Market Data
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-accent/20 data-[state=active]:to-accent/10 data-[state=active]:border-2 data-[state=active]:border-accent/40 data-[state=active]:shadow-lg data-[state=active]:shadow-accent/10 data-[state=active]:text-accent font-semibold transition-all"
            >
              {repriceMode ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {repriceMode ? 'Update Price' : 'Create Listing'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-4">
            <MarketDataTab item={item} currency={currency} />
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <CreateListingTab
              item={item}
              currency={currency}
              onSubmit={handleSubmit}
              loading={loading}
              isReprice={repriceMode}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
