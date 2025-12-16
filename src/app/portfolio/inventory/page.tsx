'use client'

/**
 * Inventory Page (V4)
 *
 * Fresh V4 implementation with:
 * - Unified market pricing (StockX + Alias)
 * - Fee-adjusted best platform recommendations
 * - Real profit/loss after fees
 * - Comprehensive filtering toolbar
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useInventoryV4 } from '@/hooks/useInventoryV4'
import { useCurrency } from '@/hooks/useCurrency'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { InventoryV4Table } from './_components/InventoryV4Table'
import { InventoryV4Toolbar, DEFAULT_FILTERS, type InventoryV4Filters } from './_components/InventoryV4Toolbar'
import { AddItemV4Modal } from './_components/AddItemV4Modal'
import { MobileInventoryV4Card } from './_components/mobile/MobileInventoryV4Card'
import { ListOnStockXModal } from '@/components/stockx/ListOnStockXModal'
import { RepriceListingModal } from '@/components/stockx/RepriceListingModal'
import { RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import type { AliasRegionId } from '@/hooks/useUserSettings'
import type { InventoryV4ItemFull } from '@/lib/inventory-v4/types'

export default function InventoryPage() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [filters, setFilters] = useState<InventoryV4Filters>(DEFAULT_FILTERS)

  // Modal states
  const [selectedItem, setSelectedItem] = useState<InventoryV4ItemFull | null>(null)
  const [listModalOpen, setListModalOpen] = useState(false)
  const [repriceModalOpen, setRepriceModalOpen] = useState(false)
  /** Item for edit/duplicate mode in AddItemV4Modal. If id present = edit, if no id = duplicate */
  const [editItem, setEditItem] = useState<InventoryV4ItemFull | null>(null)

  // Selection state for bulk actions
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Map region filter to alias region ID
  const aliasRegion: AliasRegionId = filters.region === 'UK' ? '1' : filters.region === 'EU' ? '2' : '3'

  const { items, isLoading, error, refetch, pendingSyncs, isSyncing } = useInventoryV4({
    aliasRegion,
    // Fetch all non-removed items - we filter client-side
    // Include 'active' for legacy items that haven't been migrated
    statuses: ['in_stock', 'listed', 'consigned', 'sold', 'active'],
  })
  const { symbol } = useCurrency()
  const currencySymbol = symbol()

  // Mobile detection - show cards on screens < 1024px (tablet/mobile)
  const isMobile = useMediaQuery('(max-width: 1023px)')

  // Mobile virtual scrolling ref (virtualizer setup after filteredItems)
  const mobileListRef = useRef<HTMLDivElement>(null)

  // ==========================================================================
  // DERIVED DATA FOR FILTERS
  // ==========================================================================

  const availableBrands = useMemo(() => {
    const brands = new Set<string>()
    items.forEach(item => {
      if (item.style.brand) brands.add(item.style.brand)
    })
    return Array.from(brands).sort()
  }, [items])

  const availableSizes = useMemo(() => {
    const sizes = new Set<string>()
    items.forEach(item => {
      if (item.size) sizes.add(item.size)
    })
    return Array.from(sizes).sort((a, b) => parseFloat(a) - parseFloat(b))
  }, [items])

  const customSources = useMemo(() => {
    const sources = new Set<string>()
    items.forEach(item => {
      if (item.purchase_source) sources.add(item.purchase_source)
    })
    return Array.from(sources).sort()
  }, [items])

  // ==========================================================================
  // FILTERING LOGIC
  // ==========================================================================

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const matchesName = item.style.name?.toLowerCase().includes(search)
        const matchesSku = item.style_id.toLowerCase().includes(search)
        const matchesBrand = item.style.brand?.toLowerCase().includes(search)
        if (!matchesName && !matchesSku && !matchesBrand) return false
      }

      // Status filter (listed = has active listings, unlisted = no active listings)
      if (filters.status !== 'all') {
        const hasActiveListings = item.listings.some(l => l.status === 'active')
        if (filters.status === 'listed' && !hasActiveListings) return false
        if (filters.status === 'unlisted' && hasActiveListings) return false
      }

      // Platform (market data) filter
      if (filters.platform !== 'all') {
        const hasStockx = item.marketData?.netProceeds?.stockx !== null
        const hasAlias = item.marketData?.netProceeds?.alias !== null

        if (filters.platform === 'stockx' && !hasStockx) return false
        if (filters.platform === 'alias' && !hasAlias) return false
        if (filters.platform === 'both' && (!hasStockx || !hasAlias)) return false
      }

      // Source filter
      if (filters.source !== 'all' && item.purchase_source !== filters.source) {
        return false
      }

      // Profit filter
      if (filters.profit !== 'all' && item.marketData?.realProfit != null) {
        const profit = item.marketData.realProfit
        if (filters.profit === 'profitable' && profit <= 0) return false
        if (filters.profit === 'losing' && profit >= 0) return false
      }

      // Brand filter
      if (filters.brands.length > 0) {
        if (!item.style.brand || !filters.brands.includes(item.style.brand)) {
          return false
        }
      }

      // Size filter
      if (filters.sizes.length > 0) {
        if (!filters.sizes.includes(item.size)) {
          return false
        }
      }

      return true
    })
  }, [items, filters])

  // Mobile virtual scrolling setup (must be after filteredItems)
  const MOBILE_CARD_HEIGHT = 220 // Approximate height of each mobile card
  const mobileVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => mobileListRef.current,
    estimateSize: () => MOBILE_CARD_HEIGHT,
    overscan: 3, // Render 3 extra cards above/below viewport (reduced for mobile perf)
  })

  // Scroll to top when filters change (better UX on search/filter)
  useEffect(() => {
    // Scroll mobile list to top
    if (mobileListRef.current) {
      mobileListRef.current.scrollTop = 0
    }
    // Reset virtualizer scroll position
    mobileVirtualizer.scrollToIndex(0)
  }, [filters, mobileVirtualizer])

  // ==========================================================================
  // SUMMARY CALCULATIONS
  // ==========================================================================

  const summaryData = useMemo(() => {
    const itemsWithCost = filteredItems.filter(i => i.purchase_price !== null)
    const itemsWithMarket = filteredItems.filter(i => i.marketData?.bestNetProceeds !== null)

    const totalCost = itemsWithCost.reduce((sum, i) => sum + (i.purchase_price ?? 0), 0)
    const totalMarketValue = itemsWithMarket.reduce((sum, i) => sum + (i.marketData?.value ?? 0), 0)
    const totalBestPayouts = itemsWithMarket.reduce((sum, i) => sum + (i.marketData?.bestNetProceeds ?? 0), 0)
    const totalProfit = itemsWithMarket.reduce((sum, i) => sum + (i.marketData?.realProfit ?? 0), 0)

    return {
      totalItems: filteredItems.length,
      totalCost: itemsWithCost.length > 0 ? totalCost : null,
      totalMarketValue: itemsWithMarket.length > 0 ? totalMarketValue : null,
      totalBestPayouts: itemsWithMarket.length > 0 ? totalBestPayouts : null,
      totalProfit: itemsWithMarket.length > 0 ? totalProfit : null,
    }
  }, [filteredItems])

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  const handleListOnStockX = useCallback((item: InventoryV4ItemFull) => {
    setSelectedItem(item)
    setListModalOpen(true)
  }, [])

  const handleRepriceListing = useCallback((item: InventoryV4ItemFull) => {
    setSelectedItem(item)
    setRepriceModalOpen(true)
  }, [])

  const handleDeactivateListing = useCallback(async (item: InventoryV4ItemFull) => {
    const stockxListing = item.listings.find(l => l.platform === 'stockx')
    if (!stockxListing?.external_listing_id) {
      toast.error('No StockX listing found')
      return
    }

    try {
      const res = await fetch('/api/stockx/listings/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: stockxListing.external_listing_id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to deactivate listing')
      }

      toast.success('Listing paused')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause listing')
    }
  }, [refetch])

  const handleReactivateListing = useCallback(async (item: InventoryV4ItemFull) => {
    const stockxListing = item.listings.find(l => l.platform === 'stockx')
    if (!stockxListing?.external_listing_id) {
      toast.error('No StockX listing found')
      return
    }

    try {
      const res = await fetch('/api/stockx/listings/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: stockxListing.external_listing_id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to activate listing')
      }

      toast.success('Listing activated')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate listing')
    }
  }, [refetch])

  const handleDeleteItem = useCallback(async (item: InventoryV4ItemFull) => {
    if (!confirm(`Delete ${item.style.name || item.style_id}?`)) return

    try {
      const res = await fetch(`/api/items/${item.id}/delete`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete item')
      }

      toast.success('Item deleted')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item')
    }
  }, [refetch])

  // Edit item - open edit modal with item data
  const handleEdit = useCallback((item: InventoryV4ItemFull) => {
    setEditItem(item) // Keep the id for edit mode
    setAddModalOpen(true)
  }, [])

  // Duplicate item - open modal with item data but no id (creates new item)
  const handleDuplicate = useCallback((item: InventoryV4ItemFull) => {
    // Remove id to trigger "duplicate" mode (creates new item when saved)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...itemWithoutId } = item
    setEditItem(itemWithoutId as unknown as InventoryV4ItemFull)
    setAddModalOpen(true)
  }, [])

  // Adjust tax rate - placeholder for modal
  const handleAdjustTaxRate = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Tax rate adjustment coming soon')
  }, [])

  // Delete StockX listing (not the item itself)
  const handleDeleteListing = useCallback(async (item: InventoryV4ItemFull) => {
    const stockxListing = item.listings.find(l => l.platform === 'stockx')
    if (!stockxListing?.external_listing_id) {
      toast.error('No StockX listing found')
      return
    }

    if (!confirm('Delete this StockX listing? This cannot be undone.')) return

    try {
      const res = await fetch('/api/stockx/listings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: stockxListing.external_listing_id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete listing')
      }

      toast.success('Listing deleted')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete listing')
    }
  }, [refetch])

  // Print StockX label
  const handlePrintStockXLabel = useCallback((item: InventoryV4ItemFull) => {
    const stockxListing = item.listings.find(l => l.platform === 'stockx')
    if (!stockxListing?.external_listing_id) {
      toast.error('No StockX listing found')
      return
    }
    // Open StockX print label page in new tab
    window.open(`https://stockx.com/selling/listings/${stockxListing.external_listing_id}/label`, '_blank')
  }, [])

  // ==========================================================================
  // ALIAS ACTION HANDLERS (placeholders)
  // ==========================================================================

  const handleAttachAliasProduct = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Attach Alias product coming soon')
  }, [])

  const handlePlaceAliasListing = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Place Alias listing coming soon')
  }, [])

  const handleEditAliasListing = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Edit Alias listing coming soon')
  }, [])

  const handleCancelAliasListing = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Cancel Alias listing coming soon')
  }, [])

  // ==========================================================================
  // STATUS ACTION HANDLERS
  // ==========================================================================

  const handleAddToWatchlist = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Add to watchlist coming soon')
  }, [])

  const handleAddToSellList = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Add to sell list coming soon')
  }, [])

  const handleMarkListed = useCallback(async (item: InventoryV4ItemFull) => {
    try {
      const res = await fetch(`/api/items/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'listed' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success('Marked as listed')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    }
  }, [refetch])

  const handleMarkSold = useCallback(async (item: InventoryV4ItemFull) => {
    const newStatus = item.status === 'sold' ? 'in_stock' : 'sold'
    try {
      const res = await fetch(`/api/items/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success(newStatus === 'sold' ? 'Marked as sold' : 'Marked as in stock')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    }
  }, [refetch])

  const handleMarkUnlisted = useCallback(async (item: InventoryV4ItemFull) => {
    try {
      const res = await fetch(`/api/items/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_stock' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success('Marked as unlisted')
      refetch()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    }
  }, [refetch])

  const handleTogglePersonals = useCallback((_item: InventoryV4ItemFull) => {
    toast.info('Toggle personals coming soon')
  }, [])

  // Helper to convert V4 item to modal-compatible format (LegacyItemShape)
  const selectedItemForModal = useMemo(() => {
    if (!selectedItem) return null
    const stockxListing = selectedItem.listings.find(l => l.platform === 'stockx')
    const marketData = selectedItem.marketData

    return {
      id: selectedItem.id,
      sku: selectedItem.style_id,
      brand: selectedItem.style.brand || '',
      model: selectedItem.style.name || '',
      size_uk: selectedItem.size,
      image_url: selectedItem.style.primary_image_url,
      invested: selectedItem.purchase_price ?? undefined,
      stockx: {
        mapped: !!selectedItem.style.stockx_product_id,
        productId: selectedItem.style.stockx_product_id ?? undefined,
        variantId: marketData?.variantIds?.stockxVariantId ?? undefined,
        listingId: stockxListing?.external_listing_id ?? undefined,
        listingStatus: stockxListing?.status === 'active' ? 'ACTIVE' : stockxListing?.status === 'paused' ? 'INACTIVE' : undefined,
        askPrice: stockxListing?.listed_price,
        // Market data fields (used by legacyItemToModalItem -> MarketDataTab)
        lowestAsk: marketData?.inputs?.stockxAsk ?? undefined,
        highestBid: marketData?.bids?.stockxBid ?? undefined,
        lastSale: undefined, // Not currently tracked in V4 marketData
        salesLast72h: undefined, // Not currently tracked in V4 marketData
      },
      // V4 listing for modal
      _v4StockxListing: stockxListing,
    }
  }, [selectedItem])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Inventory</h1>
              <p className="text-sm text-white/50 mt-1">
                Unified market pricing with fee-adjusted profits
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sync indicator */}
              {isSyncing && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                  <span className="text-sm text-blue-300">
                    Syncing {pendingSyncs} items...
                  </span>
                </div>
              )}

              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Add Item button */}
              <Button
                size="sm"
                onClick={() => setAddModalOpen(true)}
                className="gap-2 text-black hover:opacity-90"
                style={{ backgroundColor: '#FF7900' }}
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Items"
              value={summaryData.totalItems.toString()}
            />
            <SummaryCard
              label="Total Market Value"
              value={summaryData.totalMarketValue !== null ? summaryData.totalMarketValue.toFixed(2) : '—'}
              currencySymbol={currencySymbol}
            />
            <SummaryCard
              label="Best Payouts Total"
              value={summaryData.totalBestPayouts !== null ? summaryData.totalBestPayouts.toFixed(2) : '—'}
              currencySymbol={currencySymbol}
            />
            <SummaryCard
              label="Total Profit/Loss"
              value={summaryData.totalProfit !== null ? summaryData.totalProfit.toFixed(2) : '—'}
              currencySymbol={currencySymbol}
              colored
            />
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="max-w-[1600px] mx-auto px-4 pb-4">
        <InventoryV4Toolbar
          filters={filters}
          onFiltersChange={setFilters}
          availableBrands={availableBrands}
          availableSizes={availableSizes}
          customSources={customSources}
          totalItems={items.length}
          filteredItems={filteredItems.length}
        />
      </div>

      {/* Table (Desktop) / Cards (Mobile) */}
      <div className="max-w-[1600px] mx-auto px-4 pb-8">
        {isMobile ? (
          /* Mobile: Card Layout with Virtual Scrolling */
          <div className="space-y-3">
            {/* Select All Header */}
            {filteredItems.length > 0 && (
              <div className="flex items-center gap-3 px-2 py-2 bg-black/20 rounded-lg border border-white/10">
                <Checkbox
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedItems(new Set(filteredItems.map(i => i.id)))
                    } else {
                      setSelectedItems(new Set())
                    }
                  }}
                  aria-label="Select all items"
                />
                <span className="text-sm text-white/60">
                  {selectedItems.size > 0
                    ? `${selectedItems.size} selected`
                    : `Select all (${filteredItems.length})`}
                </span>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 text-white/40 animate-spin" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-white/40 text-sm">No items found</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first item
                </Button>
              </div>
            )}

            {/* Virtualized Item Cards */}
            {!isLoading && filteredItems.length > 0 && (
              <div
                ref={mobileListRef}
                className="overflow-auto flex-1 min-h-0"
                style={{
                  height: 'calc(100dvh - 400px)', // dvh for iOS Safari address bar
                  minHeight: '300px',
                  WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
                }}
              >
                <div
                  style={{
                    height: `${mobileVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {mobileVirtualizer.getVirtualItems().map((virtualItem) => {
                    const item = filteredItems[virtualItem.index]
                    return (
                      <div
                        key={item.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                          paddingBottom: '12px', // Space between cards
                        }}
                      >
                        <MobileInventoryV4Card
                          item={item}
                          isSelected={selectedItems.has(item.id)}
                          onSelectionChange={(checked) => {
                            const newSelected = new Set(selectedItems)
                            if (checked) {
                              newSelected.add(item.id)
                            } else {
                              newSelected.delete(item.id)
                            }
                            setSelectedItems(newSelected)
                          }}
                          onEdit={() => handleEdit(item)}
                          onDuplicate={() => handleDuplicate(item)}
                          onDelete={() => handleDeleteItem(item)}
                          onListOnStockX={() => handleListOnStockX(item)}
                          onRepriceListing={() => handleRepriceListing(item)}
                          onDeactivateListing={() => handleDeactivateListing(item)}
                          onReactivateListing={() => handleReactivateListing(item)}
                          onMarkSold={() => handleMarkSold(item)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Desktop: Table Layout */
          <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden">
            <InventoryV4Table
              items={filteredItems}
              loading={isLoading}
              // Selection
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              // Item actions
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onAdjustTaxRate={handleAdjustTaxRate}
              onDelete={handleDeleteItem}
              // StockX actions
              onListOnStockX={handleListOnStockX}
              onRepriceListing={handleRepriceListing}
              onDeactivateListing={handleDeactivateListing}
              onReactivateListing={handleReactivateListing}
              onDeleteListing={handleDeleteListing}
              onPrintStockXLabel={handlePrintStockXLabel}
              // Alias actions
              onAttachAliasProduct={handleAttachAliasProduct}
              onPlaceAliasListing={handlePlaceAliasListing}
              onEditAliasListing={handleEditAliasListing}
              onCancelAliasListing={handleCancelAliasListing}
              // Status actions
              onAddToWatchlist={handleAddToWatchlist}
              onAddToSellList={handleAddToSellList}
              onMarkListed={handleMarkListed}
              onMarkSold={handleMarkSold}
              onMarkUnlisted={handleMarkUnlisted}
              onTogglePersonals={handleTogglePersonals}
            />
          </div>
        )}
      </div>

      {/* Add Item Modal (also handles edit/duplicate) */}
      <AddItemV4Modal
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open)
          // Clear editItem when modal closes
          if (!open) setEditItem(null)
        }}
        onSuccess={refetch}
        editItem={editItem}
      />

      {/* List on StockX Modal */}
      {selectedItemForModal && (
        <ListOnStockXModal
          open={listModalOpen}
          onClose={() => {
            setListModalOpen(false)
            setSelectedItem(null)
          }}
          item={{
            ...selectedItemForModal,
            image_url: selectedItemForModal.image_url ?? undefined,
          }}
          onSuccess={() => {
            setListModalOpen(false)
            setSelectedItem(null)
            refetch()
          }}
        />
      )}

      {/* Reprice Listing Modal */}
      {selectedItem && selectedItem.listings.find(l => l.platform === 'stockx') && (
        <RepriceListingModal
          open={repriceModalOpen}
          onClose={() => {
            setRepriceModalOpen(false)
            setSelectedItem(null)
          }}
          onSuccess={() => {
            setRepriceModalOpen(false)
            setSelectedItem(null)
            refetch()
          }}
          listing={{
            stockx_listing_id: selectedItem.listings.find(l => l.platform === 'stockx')!.external_listing_id!,
            ask_price: selectedItem.listings.find(l => l.platform === 'stockx')!.listed_price,
            product_name: selectedItem.style.name ?? undefined,
            sku: selectedItem.style_id,
            alias_image_url: selectedItem.style.primary_image_url ?? undefined,
          }}
          invested={selectedItem.purchase_price ?? 0}
        />
      )}
    </div>
  )
}

// =============================================================================
// SUMMARY CARD
// =============================================================================

function SummaryCard({
  label,
  value,
  currencySymbol,
  colored = false,
}: {
  label: string
  value: string
  currencySymbol?: string
  colored?: boolean
}) {
  const numValue = Number(value)
  const isNumeric = Number.isFinite(numValue)
  const isPositive = isNumeric && numValue >= 0
  const isNegative = isNumeric && numValue < 0

  // Format: -£12.34 (sign before symbol) instead of £-12.34
  // Don't prefix currency for non-numeric values like "—"
  const displayValue = !isNumeric
    ? value
    : isNegative && currencySymbol
      ? `-${currencySymbol}${Math.abs(numValue).toFixed(2)}`
      : `${currencySymbol ?? ''}${value}`

  return (
    <div className="bg-black/30 rounded-lg border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
        {label}
      </div>
      <div
        className={`text-xl font-semibold tabular-nums ${
          colored && isNumeric
            ? isPositive
              ? 'text-emerald-400'
              : 'text-red-400'
            : 'text-white'
        }`}
      >
        {displayValue}
      </div>
    </div>
  )
}
