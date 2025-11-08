'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { usePortfolioInventory, type EnrichedInventoryItem } from '@/hooks/usePortfolioInventory'
import { useInventoryCounts } from '@/hooks/useInventoryCounts'
import { parseParams, buildQuery, type TableParams } from '@/lib/url/params'
import { useSavedViews } from '@/hooks/useSavedViews'
import { exportTaxCsv, exportInsuranceCsv } from '@/lib/portfolio/exports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download, Plus, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AddItemModal } from '@/components/modals/AddItemModal'
import type { SortingState } from '@tanstack/react-table'

// Matrix V2 Phase 3 Components
import { SavedViewChip } from '@/components/SavedViewChip'
import { ColumnChooser, type ColumnConfig } from '@/components/ColumnChooser'
import { MarketModal } from '@/components/MarketModal'

// Inventory V2 Components
import { InventoryTable } from './_components/InventoryTable'
import { FilterTabs } from './_components/FilterTabs'

export default function InventoryPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse URL params
  const urlParams = parseParams(searchParams)

  // Data fetching via portfolio hook
  const { items, loading, error: fetchError, refetch } = usePortfolioInventory()

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

  // Column visibility state
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([
    { key: 'item', label: 'Item', visible: true, lock: true },
    { key: 'purchase_date', label: 'Purchase Date', visible: true },
    { key: 'market', label: 'Market £', visible: true },
    { key: 'chart', label: 'Price Chart', visible: true },
    { key: 'qty', label: 'Qty', visible: true },
    { key: 'total', label: 'Total £', visible: true },
    { key: 'invested', label: 'Invested £', visible: true },
    { key: 'profit', label: 'Profit/Loss £', visible: true },
    { key: 'performance', label: 'Performance %', visible: true },
    { key: 'actions', label: 'Actions', visible: true },
  ])

  // Modal state
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<EnrichedInventoryItem | null>(null)
  const [marketModalOpen, setMarketModalOpen] = useState(false)
  const [selectedMarketItem, setSelectedMarketItem] = useState<EnrichedInventoryItem | null>(null)

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
    router.replace(`/dashboard/inventory${query}`)
  }

  // Callback when item is added via modal
  const handleItemAdded = () => {
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
    return items.filter((item) => {
      // Status filter
      if (selectedStatus.length > 0 && !selectedStatus.includes(item.status || '')) {
        return false
      }

      // Category filter
      if (selectedCategory.length > 0 && !selectedCategory.includes(item.category || 'other')) {
        return false
      }

      // Size filter
      if (selectedSize.length > 0 && !selectedSize.includes(item.size_uk || item.size || '')) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          item.sku.toLowerCase().includes(q) ||
          item.brand?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          item.full_title.toLowerCase().includes(q)
        if (!matches) return false
      }

      return true
    })
  }, [items, selectedStatus, selectedCategory, selectedSize, searchQuery])

  // Export CSV
  const exportCSV = () => {
    const headers = [
      'sku',
      'brand',
      'model',
      'size_uk',
      'category',
      'purchase_price',
      'tax',
      'shipping',
      'invested',
      'market_value',
      'sold_price',
      'profit',
      'performance_pct',
      'status',
      'location',
      'created_at',
    ]
    const rows = filteredItems.map((item) =>
      [
        item.sku,
        item.brand ?? '',
        item.model ?? '',
        item.size_uk ?? '',
        item.category ?? '',
        item.purchase_price,
        item.tax ?? '',
        item.shipping ?? '',
        item.invested,
        item.market_value ?? '',
        item.sold_price ?? '',
        item.profit ?? '',
        item.performance_pct ?? '',
        item.status ?? '',
        item.location ?? '',
        item.created_at,
      ].map((field) => `"${field}"`)
    )

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    a.download = `archvd-inventory-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Row action handlers
  const handleRowClick = (item: EnrichedInventoryItem) => {
    setSelectedMarketItem(item)
    setMarketModalOpen(true)
  }

  const handleEdit = (item: EnrichedInventoryItem) => {
    setEditItem(item)
    setAddItemModalOpen(true)
  }

  const handleToggleSold = async (item: EnrichedInventoryItem) => {
    // TODO: Implement toggle sold status
    console.log('Toggle sold:', item.sku)
  }

  const handleAddExpense = (item: EnrichedInventoryItem) => {
    // TODO: Implement add expense modal
    console.log('Add expense:', item.sku)
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

  // Build filter tab configs
  const statusTabs = [
    { key: 'in_stock', label: 'In Stock', count: counts.status['in_stock'] ?? 0 },
    { key: 'sold', label: 'Sold', count: counts.status['sold'] ?? 0 },
    { key: 'reserved', label: 'Reserved', count: counts.status['reserved'] ?? 0 },
  ]

  const categoryTabs = [
    { key: 'sneaker', label: 'Sneakers', count: counts.category['sneaker'] ?? 0 },
    { key: 'apparel', label: 'Apparel', count: counts.category['apparel'] ?? 0 },
    { key: 'accessory', label: 'Accessories', count: counts.category['accessory'] ?? 0 },
    { key: 'other', label: 'Other', count: counts.category['other'] ?? 0 },
  ]

  const sizeTabs = Object.entries(counts.size)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 10) // Top 10 sizes
    .map(([key, count]) => ({ key, label: key, count }))

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-[#E8F6EE]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#E8F6EE] relative inline-block">
          Inventory
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-[#0F8D65] opacity-40"></span>
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
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-3 bg-[#050807]/90 backdrop-blur border-b border-[#15251B]/40">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Add Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7FA08F]" />
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
                  'pl-9 bg-[#050807] border-[#15251B] transition-all duration-120 text-[#E8F6EE]',
                  searchQuery && 'ring-2 ring-[#00FF94]/40'
                )}
              />
            </div>

            <Button
              onClick={() => setAddItemModalOpen(true)}
              variant="default"
              size="sm"
              className="ml-auto bg-[#00FF94] text-[#000000] hover:bg-[#18D38B]"
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
            <div className="h-6 w-px bg-[#15251B]/40" />

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
                <div className="h-6 w-px bg-[#15251B]/40" />
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
                  className="text-xs text-[#7FA08F] hover:text-[#E8F6EE]"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-[#15251B] max-md:hidden"
                onClick={() => exportTaxCsv(items as any)}
                disabled={items.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> Tax
              </Button>
              <Button
                variant="outline"
                className="border-[#15251B] max-md:hidden"
                onClick={() => exportInsuranceCsv(items as any)}
                disabled={items.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> Insurance
              </Button>
              <Button
                variant="outline"
                className="border-[#15251B] max-md:hidden"
                onClick={exportCSV}
                disabled={filteredItems.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="border-[#15251B] max-md:hidden border-[#00FF94]/40 text-[#00FF94] hover:bg-[#00FF94]/10"
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
        <div className="border-l-4 border-l-[#FF4D5E] bg-[#08100C] p-4 rounded-lg">
          <p className="text-sm text-[#FF4D5E] font-medium">Error: {fetchError}</p>
        </div>
      )}

      {/* Portfolio Table */}
      <InventoryTable
        items={filteredItems}
        loading={loading}
        sorting={sorting}
        onSortingChange={setSorting}
        columnVisibility={columnVisibility}
        onRowClick={handleRowClick}
        onEdit={handleEdit}
        onToggleSold={handleToggleSold}
        onAddExpense={handleAddExpense}
      />

      {/* Add Item Modal */}
      <AddItemModal
        open={addItemModalOpen}
        onOpenChange={setAddItemModalOpen}
        onSuccess={handleItemAdded}
      />

      {/* Market Modal */}
      {selectedMarketItem && (
        <MarketModal
          open={marketModalOpen}
          onOpenChange={setMarketModalOpen}
          product={{
            name: selectedMarketItem.full_title,
            sku: selectedMarketItem.sku,
            brand: selectedMarketItem.brand || '',
          }}
          sizes={['UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12']}
          activeSize={selectedMarketItem.size_uk || selectedMarketItem.size || 'UK9'}
          onSizeChange={() => {}}
          range="30d"
          onRangeChange={() => {}}
          series={selectedMarketItem.sparkline_data.map((d) => ({
            date: d.date,
            price: d.value,
          }))}
          sourceBadge={selectedMarketItem.market_source}
          lastUpdatedISO={selectedMarketItem.market_updated_at || new Date().toISOString()}
        />
      )}
    </div>
  )
}
