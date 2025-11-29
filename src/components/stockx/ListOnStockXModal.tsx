// @ts-nocheck
'use client'

/**
 * Enhanced StockX Listing Modal
 *
 * Comprehensive listing creation modal with:
 * - Market Data tab: Price trends, stats, and insights
 * - Create Listing tab: Form with automation rules and fee breakdown
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Plus, Check, X } from 'lucide-react'
import { MarketDataTab } from './tabs/MarketDataTab'
import { CreateListingTab, type ListingFormData } from './tabs/CreateListingTab'

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
  const [activeTab, setActiveTab] = useState<'market' | 'create'>('market')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Get currency from item or default to GBP
  const currency = item?.market_currency || 'GBP'

  const handleClose = () => {
    if (loading || success) return
    setError(null)
    setSuccess(false)
    setActiveTab('market')
    onClose()
  }

  const handleSubmit = async (formData: ListingFormData) => {
    setLoading(true)
    setError(null)

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

      // Handle timeout specifically
      if (err.name === 'AbortError') {
        setError('Request timed out after 45 seconds. StockX may be slow. Please try again.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-elev-2 via-elev-2 to-accent/5 backdrop-blur-md shadow-2xl border-2 border-accent/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-accent/20 border border-accent/40">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <span className="font-bold text-accent">
              List on StockX
            </span>
          </DialogTitle>

          {/* Item Info - Enhanced Card */}
          <div className="text-left pt-3">
            <div className="p-5 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg hover:shadow-xl hover:border-accent/40 transition-all duration-200">
              <div className="flex gap-4">
                {/* Product Image - Alias → StockX → Inventory priority */}
                {(item.alias_image_url || item.image?.url || item.stockx_image_url || item.image_url) && (
                  <img
                    src={item.alias_image_url || item.image?.url || item.stockx_image_url || item.image_url}
                    alt={`${item.brand} ${item.model}`}
                    className="w-20 h-20 rounded-lg object-cover bg-elev-2 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-fg">
                    {item.model?.trim().toLowerCase().startsWith(item.brand?.toLowerCase())
                      ? item.model.trim()
                      : `${item.brand} ${item.model}`.trim()
                    }
                  </div>
                  <div className="text-sm text-muted mt-1">{item.colorway}</div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-dim font-mono bg-soft px-2 py-1 rounded border border-border">{item.sku}</span>
                    <span className="text-xs font-medium text-muted">Size {item.size_uk || item.size} {item.size_uk ? 'UK' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Error Message - Vibrant Red */}
        {error && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-red-400 bg-gradient-to-r from-red-500/20 to-red-500/10 border-2 border-red-500/50 rounded-xl shadow-lg shadow-red-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-red-500/20">
              <X className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message - Vibrant Green */}
        {success && (
          <div className="flex items-center gap-3 p-4 text-sm font-medium text-emerald-400 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/50 rounded-xl shadow-lg shadow-emerald-500/10 -mt-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20">
              <Check className="w-4 h-4 flex-shrink-0" />
            </div>
            <span>Listing created successfully!</span>
          </div>
        )}

        {/* Tabs - Enhanced Styling */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
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
              <Plus className="h-4 w-4" />
              Create Listing
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
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
