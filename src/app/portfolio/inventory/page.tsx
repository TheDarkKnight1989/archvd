'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useInventoryV3 } from '@/hooks/useInventoryV3'
import type { EnrichedLineItem } from '@/lib/portfolio/types'
import { useInventoryCounts } from '@/hooks/useInventoryCounts'
import { parseParams, buildQuery, type TableParams } from '@/lib/url/params'
import { useSavedViews } from '@/hooks/useSavedViews'
import { exportTaxCsv, exportInsuranceCsv } from '@/lib/portfolio/exports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download, Plus, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AddItemModal } from '@/components/modals/AddItemModal'
import { MarkAsSoldModal } from '@/components/modals/MarkAsSoldModal'
import { AddToWatchlistPicker } from '@/components/AddToWatchlistPicker'
import { ListOnStockXModal } from '@/components/stockx/ListOnStockXModal'
import { RepriceListingModal } from '@/components/stockx/RepriceListingModal'
import { useListingOperations } from '@/hooks/useStockxListings'
import type { SortingState } from '@tanstack/react-table'

// Matrix V2 Phase 3 Components
import { SavedViewChip } from '@/components/SavedViewChip'
import { ColumnChooser, type ColumnConfig } from '@/components/ColumnChooser'
import { MarketModal } from '@/components/MarketModal'

// Portfolio V3 Components
import { InventoryTableV3 } from './_components/InventoryTableV3'
import { FilterTabs } from './_components/FilterTabs'

export default function PortfolioPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse URL params
  const urlParams = parseParams(searchParams)

  // Data fetching via V3 hook
  const { items, loading, error: fetchError, refetch } = useInventoryV3()

  // Filter out sold items (they belong in Sales page now)
  const activeItems = useMemo(() => {
    return items.filter(item => item.status !== 'sold')
  }, [items])

  // Get counts for filter tabs
  const { data: counts } = useInventoryCounts(user?.id)

  // Saved views
  const savedViews = useSavedViews()

  // Filter state from URL
  const [searchQuery, setSearchQuery] = useState<string>(urlParams.search || '')
  const selectedStatus = urlParams.status || []
  const selectedCategory = urlParams.category && urlParams.category.length > 0 ? urlParams.category : ['sneaker']
  const selectedSize = urlParams.size_uk?.map(String) || []

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'purchase_date', desc: true }, // Default: newest first
  ])

  // Column visibility state - Updated to match new Portfolio table spec
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([
    { key: 'item', label: 'Item', visible: true, lock: true },
    { key: 'sku', label: 'SKU', visible: true },
    { key: 'category', label: 'Category', visible: true },
    { key: 'purchase_date', label: 'Purchase Date', visible: true },
    { key: 'buy', label: 'Buy £', visible: true },
    { key: 'total', label: 'Total £', visible: true },
    { key: 'market', label: 'Market £', visible: true },
    { key: 'gain_loss_pct', label: '% Gain/Loss', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'actions', label: 'Actions', visible: true },
  ])

  // Modal state
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<EnrichedLineItem | null>(null)
  const [marketModalOpen, setMarketModalOpen] = useState(false)
  const [selectedMarketItem, setSelectedMarketItem] = useState<EnrichedLineItem | null>(null)
  const [markAsSoldModalOpen, setMarkAsSoldModalOpen] = useState(false)
  const [itemToSell, setItemToSell] = useState<EnrichedLineItem | null>(null)
  const [watchlistPickerOpen, setWatchlistPickerOpen] = useState(false)
  const [selectedItemForWatchlist, setSelectedItemForWatchlist] = useState<EnrichedLineItem | null>(null)

  // StockX modal state
  const [listOnStockXModalOpen, setListOnStockXModalOpen] = useState(false)
  const [itemToList, setItemToList] = useState<any | null>(null)
  const [repriceModalOpen, setRepriceModalOpen] = useState(false)
  const [listingToReprice, setListingToReprice] = useState<any | null>(null)

  // StockX operations
  const { deactivateListing, activateListing, deleteListing } = useListingOperations()

  // Update URL params
  const updateParams = (updates: Partial<TableParams>) => {
    const merged: TableParams = {
      status: selectedStatus,
      category: selectedCategory,
      size_uk: selectedSize,
      search: searchQuery || undefined,
      ...updates,
    }

    // Remove empty values
    if (merged.status?.length === 0) delete merged.status
    if (merged.category?.length === 0) delete merged.category
    if (merged.size_uk?.length === 0) delete merged.size_uk
    if (!merged.search?.trim()) delete merged.search

    const query = buildQuery(merged)
    router.replace(`/portfolio/inventory${query}`)
  }

  // Callback when item is added via modal
  const handleItemAdded = async () => {
    // Small delay to ensure database transaction completes
    await new Promise(resolve => setTimeout(resolve, 300))
    refetch()
  }

  // Apply active saved view filters
  const applySavedView = (viewId: string) => {
    const view = savedViews.views.find((v) => v.id === viewId)
    if (view) {
      updateParams({
        status: view.filters.status ? [view.filters.status] : [],
        category: view.filters.category ? [view.filters.category] : ['sneaker'],
        size_uk: view.filters.size ? [view.filters.size] : [],
        search: view.filters.search || undefined,
      })
      setSorting(view.sorting)
      savedViews.setActiveView(viewId)
    }
  }

  // Save current view
  const saveCurrentView = (name: string) => {
    savedViews.createView(
      name,
      {
        status: selectedStatus[0],
        category: selectedCategory[0],
        size: selectedSize[0],
        search: searchQuery || undefined,
      },
      sorting
    )
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      // Status filter
      if (selectedStatus.length > 0 && !selectedStatus.includes(item.status || '')) {
        return false
      }

      // Category filter
      if (selectedCategory.length > 0 && !selectedCategory.includes(item.category || 'other')) {
        return false
      }

      // Size filter
      const sizeStr = item.size_uk?.toString() || ''
      if (selectedSize.length > 0 && !selectedSize.includes(sizeStr)) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          item.sku.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          (item.colorway?.toLowerCase().includes(q) || false)
        if (!matches) return false
      }

      return true
    })
  }, [activeItems, selectedStatus, selectedCategory, selectedSize, searchQuery])

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'item',
      'sku',
      'brand',
      'model',
      'category',
      'size_uk',
      'purchase_date',
      'buy_price',
      'tax',
      'shipping',
      'total_cost',
      'market_value',
      'instant_sell',
      'gain_loss_pct',
      'status',
      'location',
      'created_at',
    ]
    const rows = filteredItems.map((item) => {
      const invested = item.invested || 0
      const market = item.market.price || 0
      const gainLossPct = item.performancePct ?? ''
      const fullTitle = [item.brand, item.model, item.colorway].filter(Boolean).join(' ')

      return [
        fullTitle,
        item.sku,
        item.brand ?? '',
        item.model ?? '',
        item.category ?? '',
        item.size_uk ?? '',
        item.purchaseDate ?? '',
        item.avgCost.toFixed(2),
        '', // tax (not available in V3)
        '', // shipping (not available in V3)
        invested.toFixed(2),
        market !== 0 ? market.toFixed(2) : '',
        item.instantSell?.gross ?? '',
        gainLossPct !== '' ? gainLossPct.toFixed(2) : '',
        item.status ?? '',
        '', // location (not available in V3)
        '', // created_at (not available in V3)
      ].map((field) => `"${field}"`)
    })

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    a.download = `archvd-portfolio-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Row action handlers
  const handleRowClick = (item: EnrichedLineItem) => {
    setSelectedMarketItem(item)
    setMarketModalOpen(true)
  }

  const handleEdit = (item: EnrichedLineItem) => {
    setEditItem(item)
    setAddItemModalOpen(true)
  }

  const handleToggleSold = async (item: EnrichedLineItem) => {
    setItemToSell(item)
    setMarkAsSoldModalOpen(true)
  }

  const handleAddExpense = (item: EnrichedLineItem) => {
    // TODO: Implement add expense modal
    console.log('Add expense:', item.sku)
  }

  const handleAddToWatchlist = (item: EnrichedLineItem) => {
    setSelectedItemForWatchlist(item)
    setWatchlistPickerOpen(true)
  }

  // StockX action handlers
  const handleListOnStockX = (item: EnrichedLineItem) => {
    setItemToList(item)
    setListOnStockXModalOpen(true)
  }

  const handleRepriceListing = (item: EnrichedLineItem) => {
    // Convert EnrichedLineItem to format expected by modal
    setListingToReprice({
      stockx_listing_id: (item as any).stockx_listing_id,
      ask_price: (item as any).stockx_ask_price || item.market.price || 0,
      market_lowest_ask: item.market.price,
      product_name: `${item.brand} ${item.model}`,
      sku: item.sku,
    })
    setRepriceModalOpen(true)
  }

  const handleDeactivateListing = async (item: EnrichedLineItem) => {
    const listingId = (item as any).stockx_listing_id
    if (listingId) {
      await deactivateListing(listingId)
      refetch()
    }
  }

  const handleReactivateListing = async (item: EnrichedLineItem) => {
    const listingId = (item as any).stockx_listing_id
    if (listingId) {
      await activateListing(listingId)
      refetch()
    }
  }

  const handleDeleteListing = async (item: EnrichedLineItem) => {
    const listingId = (item as any).stockx_listing_id
    if (listingId && confirm('Are you sure you want to delete this listing?')) {
      await deleteListing(listingId)
      refetch()
    }
  }

  const handleDeleteItem = async (item: EnrichedLineItem) => {
    const itemName = `${item.brand} ${item.model} (${item.sku})`
    if (!confirm(`Are you sure you want to permanently delete "${itemName}"?\n\nThis will remove the item and all associated data (expenses, listings, etc.). This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/items/${item.id}/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete item')
      }

      // Refetch inventory data
      refetch()

      // Show success message
      console.log('Item deleted successfully:', itemName)
    } catch (error: any) {
      console.error('Failed to delete item:', error)
      alert(`Failed to delete item: ${error.message}`)
    }
  }

  // Active filter count
  const activeFilterCount =
    (selectedStatus.length > 0 ? 1 : 0) +
    (selectedCategory.length > 0 && selectedCategory[0] !== 'sneaker' ? 1 : 0) +
    (selectedSize.length > 0 ? 1 : 0) +
    (searchQuery ? 1 : 0)

  // Convert columnConfig to columnVisibility object
  const columnVisibility = useMemo(() => {
    return columnConfig.reduce((acc, col) => {
      acc[col.key] = col.visible
      return acc
    }, {} as Record<string, boolean>)
  }, [columnConfig])

  // Build filter tab configs - Updated to use new status enum
  const statusTabs = [
    { key: 'active', label: 'Active', count: counts.status['active'] ?? 0 },
    { key: 'listed', label: 'Listed', count: counts.status['listed'] ?? 0 },
    { key: 'worn', label: 'Worn', count: counts.status['worn'] ?? 0 },
  ]

  const categoryTabs = [
    { key: 'sneaker', label: 'Sneakers', count: counts.category['sneaker'] ?? 0 },
    { key: 'pokemon', label: 'Pokémon (sealed)', count: counts.category['pokemon'] ?? 0 },
    { key: 'apparel', label: 'Apparel', count: counts.category['apparel'] ?? 0 },
    { key: 'accessory', label: 'Accessories', count: counts.category['accessory'] ?? 0 },
    { key: 'other', label: 'Other', count: counts.category['other'] ?? 0 },
  ]

  const sizeTabs = Object.entries(counts.size)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 10) // Top 10 sizes
    .map(([key, count]) => ({ key, label: key, count }))

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-fg tracking-tight relative inline-block">
          Portfolio
          <span className="absolute bottom-0 left-0 w-16 h-px bg-accent/30"></span>
        </h1>

        {/* Saved Views */}
        <div className="flex items-center gap-2">
          {savedViews.views.map((view) => (
            <SavedViewChip
              key={view.id}
              label={view.name}
              active={savedViews.activeViewId === view.id}
              onApply={() => applySavedView(view.id)}
              onDelete={() => savedViews.deleteView(view.id)}
            />
          ))}
        </div>
      </div>

      {/* Toolbar - Sticky with glowing tabs */}
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-3 bg-bg/90 backdrop-blur border-b border-border/40">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Add Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="Search SKU, brand, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => updateParams({ search: searchQuery || undefined })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateParams({ search: searchQuery || undefined })
                  }
                }}
                className={cn(
                  'pl-9 bg-elev-0 border-border transition-boutique text-fg',
                  searchQuery && 'ring-2 ring-focus'
                )}
              />
            </div>

            <Button
              onClick={() => setAddItemModalOpen(true)}
              variant="default"
              size="sm"
              className="ml-auto transition-boutique shadow-soft"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {/* Row 2: Filter Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Tabs (multi-select) */}
            <FilterTabs
              tabs={statusTabs}
              value={selectedStatus}
              onChange={(keys) => updateParams({ status: keys })}
              multiselect
            />

            {/* Divider */}
            <div className="h-6 w-px bg-border/40" />

            {/* Category Tabs (single-select) */}
            <FilterTabs
              tabs={categoryTabs}
              value={selectedCategory}
              onChange={(keys) => updateParams({ category: keys.length > 0 ? keys : ['sneaker'] })}
              multiselect={false}
            />

            {/* Size Tabs (multi-select) - Only show if we have sizes */}
            {sizeTabs.length > 0 && (
              <>
                <div className="h-6 w-px bg-border/40" />
                <FilterTabs
                  tabs={sizeTabs}
                  value={selectedSize}
                  onChange={(keys) => updateParams({ size_uk: keys })}
                  multiselect
                  className="flex-1 justify-end"
                />
              </>
            )}
          </div>

          {/* Row 3: Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    updateParams({ status: [], category: ['sneaker'], size_uk: [], search: undefined })
                  }}
                  className="text-xs text-muted hover:text-fg"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-border max-md:hidden"
                onClick={() => exportTaxCsv(items as any)}
                disabled={items.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> Tax
              </Button>
              <Button
                variant="outline"
                className="border-border max-md:hidden"
                onClick={() => exportInsuranceCsv(items as any)}
                disabled={items.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> Insurance
              </Button>
              <Button
                variant="outline"
                className="border-border max-md:hidden"
                onClick={exportCSV}
                disabled={filteredItems.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="border-border max-md:hidden border-accent/40 text-accent hover:bg-accent/10"
                  onClick={() => {
                    const name = prompt('Enter a name for this view:')
                    if (name) saveCurrentView(name)
                  }}
                  size="sm"
                >
                  <Bookmark className="h-4 w-4 mr-2" /> Save View
                </Button>
              )}
              <ColumnChooser
                columns={columnConfig}
                onChange={(updated) => {
                  setColumnConfig(prev =>
                    prev.map(col => ({
                      ...col,
                      visible: updated.find(u => u.key === col.key)?.visible ?? col.visible
                    }))
                  )
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fetch Error Alert */}
      {fetchError && (
        <div className="border-l-4 border-l-danger bg-elev-1 p-4 rounded-lg">
          <p className="text-sm text-danger font-medium">Error: {fetchError}</p>
        </div>
      )}

      {/* Portfolio Table V3 */}
      <InventoryTableV3
        items={filteredItems}
        loading={loading}
        onRowClick={handleRowClick}
        onEdit={handleEdit}
        onMarkSold={handleToggleSold}
        onAddExpense={handleAddExpense}
        onAddToWatchlist={handleAddToWatchlist}
        onAddItem={() => setAddItemModalOpen(true)}
        onDelete={handleDeleteItem}
        onListOnStockX={handleListOnStockX}
        onRepriceListing={handleRepriceListing}
        onDeactivateListing={handleDeactivateListing}
        onReactivateListing={handleReactivateListing}
        onDeleteListing={handleDeleteListing}
      />

      {/* Add Item Modal */}
      <AddItemModal
        open={addItemModalOpen}
        onOpenChange={setAddItemModalOpen}
        onSuccess={handleItemAdded}
      />

      {/* Mark as Sold Modal */}
      <MarkAsSoldModal
        open={markAsSoldModalOpen}
        onOpenChange={setMarkAsSoldModalOpen}
        item={itemToSell ? {
          id: itemToSell.id,
          sku: itemToSell.sku,
          brand: itemToSell.brand,
          model: itemToSell.model,
          purchase_price: itemToSell.invested, // WHY: V3 uses invested instead of purchase_price
          tax: 0, // WHY: tax is included in invested
          shipping: 0, // WHY: shipping is included in invested
        } : null}
        onSuccess={handleItemAdded}
      />

      {/* Market Modal */}
      {selectedMarketItem && (
        <MarketModal
          open={marketModalOpen}
          onOpenChange={setMarketModalOpen}
          product={{
            name: `${selectedMarketItem.brand} ${selectedMarketItem.model}`,
            sku: selectedMarketItem.sku,
            brand: selectedMarketItem.brand || '',
          }}
          sizes={['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12']}
          activeSize={selectedMarketItem.size_uk?.toString() || 'UK9'}
          onSizeChange={() => {}}
          range="30d"
          onRangeChange={() => {}}
          series={selectedMarketItem.market.spark30d.map((d) => ({
            date: d.date,
            price: d.price || 0,
          }))}
          sourceBadge={selectedMarketItem.market.provider || 'unknown'}
          lastUpdatedISO={selectedMarketItem.market.updatedAt || new Date().toISOString()}
        />
      )}

      {/* Add to Watchlist Picker */}
      {selectedItemForWatchlist && (
        <AddToWatchlistPicker
          open={watchlistPickerOpen}
          onOpenChange={setWatchlistPickerOpen}
          sku={selectedItemForWatchlist.sku}
          defaultSize={selectedItemForWatchlist.size_uk?.toString() || undefined}
        />
      )}

      {/* List on StockX Modal */}
      {itemToList && (
        <ListOnStockXModal
          open={listOnStockXModalOpen}
          onClose={() => {
            setListOnStockXModalOpen(false)
            setItemToList(null)
          }}
          onSuccess={() => {
            refetch()
            setListOnStockXModalOpen(false)
            setItemToList(null)
          }}
          item={{
            id: itemToList.id,
            sku: itemToList.sku,
            brand: itemToList.brand,
            model: itemToList.model,
            size_uk: itemToList.size_uk?.toString(),
            purchase_price: itemToList.invested || itemToList.avgCost || 0,
            tax: 0,
            shipping: 0,
            market_price: itemToList.market.price,
            market_last_sale: itemToList.market.lastSale,
            market_lowest_ask: itemToList.market.lowestAsk,
            market_highest_bid: itemToList.instantSell.gross,
          }}
        />
      )}

      {/* Reprice Listing Modal */}
      {listingToReprice && (
        <RepriceListingModal
          open={repriceModalOpen}
          onClose={() => {
            setRepriceModalOpen(false)
            setListingToReprice(null)
          }}
          onSuccess={() => {
            refetch()
            setRepriceModalOpen(false)
            setListingToReprice(null)
          }}
          listing={listingToReprice}
          invested={(itemToList?.invested || itemToList?.avgCost || 0)}
        />
      )}
    </div>
  )
}
