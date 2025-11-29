'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useInventoryV3 } from '@/hooks/useInventoryV3'
import type { EnrichedLineItem } from '@/lib/portfolio/types'
import { generateProductSlug } from '@/lib/utils/slug'
import { useInventoryCounts } from '@/hooks/useInventoryCounts'
import { parseParams, buildQuery, type TableParams } from '@/lib/url/params'
import { useSavedViews } from '@/hooks/useSavedViews'
import { exportTaxCsv, exportInsuranceCsv } from '@/lib/portfolio/exports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Download, Plus, Bookmark, ChevronDown, FileText, Shield, Receipt, Clock, RefreshCw, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AddItemModal } from '@/components/modals/AddItemModal'
import { MarkAsSoldModal } from '@/components/modals/MarkAsSoldModal'
import { AddToWatchlistPicker } from '@/components/AddToWatchlistPicker'
import { AddToSellListModal } from '@/components/modals/AddToSellListModal'
import { ListOnStockXModal } from '@/components/stockx/ListOnStockXModal'
import { RepriceListingModal } from '@/components/stockx/RepriceListingModal'
import { BulkListOnStockXModal } from '@/components/stockx/BulkListOnStockXModal'
import { ConfirmAliasMatchModal } from '@/components/alias/ConfirmAliasMatchModal'
import { SetPriceModal } from '@/components/alias/SetPriceModal'
import { NoAliasMatchModal } from '@/components/alias/NoAliasMatchModal'
import { Toast } from '@/components/ui/toast'
import { useListingOperations } from '@/hooks/useStockxListings'
import type { SortingState } from '@tanstack/react-table'

// Matrix V2 Phase 3 Components
import { SavedViewChip } from '@/components/SavedViewChip'
import { ColumnChooser, type ColumnConfig } from '@/components/ColumnChooser'
import { MarketModal } from '@/components/MarketModal'

// Portfolio V3 Components
import { InventoryTableV3 } from './_components/InventoryTableV3'
import { FilterTabs } from './_components/FilterTabs'
import { InventoryV3Table } from './_components/InventoryV3Table'
import { SyncToolbar } from './_components/SyncToolbar'

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

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  // Platform state ('stockx' or 'alias')
  const [platform, setPlatform] = useState<'stockx' | 'alias'>('stockx')

  // Quick filter logic
  const applyQuickFilter = (filterKey: string) => {
    setQuickFilter(quickFilter === filterKey ? null : filterKey)
  }

  // Filter state from URL
  const [searchQuery, setSearchQuery] = useState<string>(urlParams.search || '')
  const selectedStatus = urlParams.status || []
  const selectedCategory = urlParams.category && urlParams.category.length > 0 ? urlParams.category : ['sneaker']
  const selectedSize = urlParams.size_uk?.map(String) || []

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'purchase_date', desc: true }, // Default: newest first
  ])

  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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
  const [sellListModalOpen, setSellListModalOpen] = useState(false)
  const [selectedItemsForSellList, setSelectedItemsForSellList] = useState<string[]>([])

  // StockX modal state
  const [listOnStockXModalOpen, setListOnStockXModalOpen] = useState(false)
  const [itemToList, setItemToList] = useState<any | null>(null)
  const [repriceModalOpen, setRepriceModalOpen] = useState(false)
  const [listingToReprice, setListingToReprice] = useState<any | null>(null)
  const [bulkListModalOpen, setBulkListModalOpen] = useState(false)

  // Alias modal state
  const [confirmAliasMatchOpen, setConfirmAliasMatchOpen] = useState(false)
  const [noAliasMatchOpen, setNoAliasMatchOpen] = useState(false)
  const [setPriceModalOpen, setSetPriceModalOpen] = useState(false)
  const [aliasMatchSuggestion, setAliasMatchSuggestion] = useState<any | null>(null)
  const [itemForAliasListing, setItemForAliasListing] = useState<EnrichedLineItem | null>(null)
  const [aliasListingLoading, setAliasListingLoading] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; variant: 'default' | 'success' | 'error' } | null>(null)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null)

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

  // Handle modal open/close and clear edit state when closing
  const handleAddItemModalChange = (open: boolean) => {
    setAddItemModalOpen(open)
    if (!open) {
      setEditItem(null)
    }
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

      // Quick filters
      if (quickFilter === 'listed-stockx') {
        if (!item.stockx?.listingId) return false
      } else if (quickFilter === 'profitable') {
        const profit = (item.market?.price || 0) - (item.invested || 0)
        if (profit <= 0) return false
      } else if (quickFilter === 'loss-making') {
        const profit = (item.market?.price || 0) - (item.invested || 0)
        if (profit >= 0) return false
      } else if (quickFilter === 'never-listed') {
        if (item.stockx?.listingId || item.alias?.listingId) return false
      } else if (quickFilter === 'added-this-week') {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        if (new Date(item.created_at) <= oneWeekAgo) return false
      }

      return true
    })
  }, [activeItems, selectedStatus, selectedCategory, selectedSize, searchQuery, quickFilter, platform])

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
    // Navigate to Product Market Page with slug-based URL and itemId for position data
    const productName = `${item.brand || ''} ${item.model || ''}`.trim()
    const sku = item.sku || ''
    const slug = sku ? generateProductSlug(productName, sku) : null
    const marketUrl = slug ? `/portfolio/market/${slug}?itemId=${item.id}` : `/portfolio/inventory/market/${item.id}`
    router.push(marketUrl)
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

  const handleDuplicateItem = (item: EnrichedLineItem) => {
    // Set the item to duplicate (without ID) to pre-fill the add modal
    const duplicatedItem = { ...item, id: undefined } as any
    setEditItem(duplicatedItem)
    setAddItemModalOpen(true)
  }

  const handleAdjustTaxRate = (item: EnrichedLineItem) => {
    // TODO: Implement adjust tax rate modal
    console.log('Adjust tax rate:', item.sku)
  }

  // StockX action handlers
  const handleListOnStockX = (item: EnrichedLineItem) => {
    setItemToList(item)
    setListOnStockXModalOpen(true)
  }

  const handleRepriceListing = async (item: EnrichedLineItem) => {
    const listingId = item.stockx?.listingId
    if (!listingId) {
      console.error('No listing ID found for item')
      return
    }

    // Fetch real listing price from StockX
    try {
      const response = await fetch(`/api/stockx/listings/${listingId}`)
      const listingData = await response.json()

      // Convert EnrichedLineItem to format expected by modal with real ask price
      setListingToReprice({
        stockx_listing_id: listingId,
        ask_price: listingData.amount ? parseFloat(listingData.amount) : (item.stockx?.askPrice || item.market.price || 0),
        market_lowest_ask: item.market.price,
        product_name: `${item.brand} ${item.model}`,
        sku: item.sku,
      })
    } catch (error) {
      console.error('Failed to fetch listing details:', error)
      // Fallback to cached data
      setListingToReprice({
        stockx_listing_id: listingId,
        ask_price: item.stockx?.askPrice || item.market.price || 0,
        market_lowest_ask: item.market.price,
        product_name: `${item.brand} ${item.model}`,
        sku: item.sku,
      })
    }

    setRepriceModalOpen(true)
  }

  const handleDeactivateListing = async (item: EnrichedLineItem) => {
    const listingId = item.stockx?.listingId
    if (!listingId) return

    try {
      await deactivateListing(listingId)
      setToast({
        message: 'Listing deactivated successfully',
        variant: 'success'
      })
      refetch()
    } catch (error: any) {
      setToast({
        message: error.message || 'Failed to deactivate listing',
        variant: 'error'
      })
    }
  }

  const handleReactivateListing = async (item: EnrichedLineItem) => {
    const listingId = item.stockx?.listingId
    if (!listingId) return

    try {
      await activateListing(listingId)
      setToast({
        message: 'Listing reactivated successfully',
        variant: 'success'
      })
      refetch()
    } catch (error: any) {
      setToast({
        message: error.message || 'Failed to reactivate listing',
        variant: 'error'
      })
    }
  }

  const handleDeleteListing = async (item: EnrichedLineItem) => {
    const listingId = item.stockx?.listingId
    if (!listingId) return
    if (!confirm('Are you sure you want to delete this listing?')) return

    try {
      await deleteListing(listingId)
      setToast({
        message: 'Listing deleted successfully',
        variant: 'success'
      })
      refetch()
    } catch (error: any) {
      setToast({
        message: error.message || 'Failed to delete listing',
        variant: 'error'
      })
    }
  }

  const handlePrintStockXLabel = (item: EnrichedLineItem) => {
    // TODO: Implement print label functionality
    console.log('Print StockX label:', item.sku)
  }

  // Alias action handlers
  const handlePlaceAliasListing = async (item: EnrichedLineItem) => {
    setItemForAliasListing(item)
    setAliasListingLoading(true)

    try {
      // Check if already has a listing
      if (item.alias?.listingId) {
        setToast({
          message: 'This item already has an Alias listing.',
          variant: 'default',
        })
        setAliasListingLoading(false)
        return
      }

      // Check if mapped to Alias
      if (!item.alias?.mapped || !item.alias?.catalogId) {
        // Not mapped - need to find a match first
        console.log('[Alias] Item not mapped, calling SKU matcher...')

        const matchResponse = await fetch('/api/alias/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: item.sku,
            productName: `${item.brand} ${item.model}`,
            brand: item.brand,
          }),
        })

        if (!matchResponse.ok) {
          throw new Error('Failed to match item to Alias catalog')
        }

        const matchData = await matchResponse.json()

        if (matchData.catalogId && matchData.confidence > 0) {
          // Found a match - show confirmation modal
          setAliasMatchSuggestion({
            catalogId: matchData.catalogId,
            name: matchData.catalogItem?.name || 'Unknown',
            sku: matchData.catalogItem?.sku || item.sku,
            brand: matchData.catalogItem?.brand || item.brand,
            confidence: matchData.confidence,
            catalogItem: matchData.catalogItem, // Store full catalog item for size_unit
          })
          setConfirmAliasMatchOpen(true)
          setAliasListingLoading(false)
        } else {
          // No match found
          setNoAliasMatchOpen(true)
          setAliasListingLoading(false)
        }
      } else {
        // Already mapped - fetch catalog item and show price modal
        const catalogResponse = await fetch(`/api/alias/catalog/${item.alias.catalogId}`)
        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json()

          setAliasMatchSuggestion({
            catalogId: item.alias.catalogId,
            name: catalogData.item?.name || 'Unknown',
            sku: catalogData.item?.sku || item.sku,
            brand: catalogData.item?.brand || item.brand,
            confidence: 1.0,
            catalogItem: catalogData.item,
          })

          // Skip match confirmation, go straight to price modal
          setSetPriceModalOpen(true)
          setAliasListingLoading(false)
        } else {
          throw new Error('Failed to fetch catalog item')
        }
      }
    } catch (error) {
      console.error('[Alias] Error in handlePlaceAliasListing:', error)
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create Alias listing',
        variant: 'error',
      })
      setAliasListingLoading(false)
    }
  }

  const handleConfirmAliasMatch = async () => {
    if (!itemForAliasListing || !aliasMatchSuggestion) return

    setAliasListingLoading(true)

    try {
      // Create the mapping first
      const linkResponse = await fetch('/api/alias/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_id: itemForAliasListing.id,
          alias_catalog_id: aliasMatchSuggestion.catalogId,
          match_confidence: aliasMatchSuggestion.confidence,
        }),
      })

      if (!linkResponse.ok) {
        const errorData = await linkResponse.json()
        console.error('[Alias] Link API error:', errorData)
        const errorMessage = errorData.details || errorData.message || errorData.error || 'Failed to create Alias mapping'
        throw new Error(errorMessage)
      }

      // Close confirmation modal and show price selection
      setConfirmAliasMatchOpen(false)
      setSetPriceModalOpen(true)
    } catch (error) {
      console.error('[Alias] Error confirming match:', error)
      setToast({
        message: error instanceof Error ? error.message : 'Failed to confirm match',
        variant: 'error',
      })
      setAliasListingLoading(false)
    }
  }

  const handleSetPrice = async (priceGBP: number) => {
    console.log('═══════════════════════════════════════')
    console.log('[Alias] ⚠️ handleSetPrice CALLED')
    console.log('[Alias] Price:', priceGBP)
    console.log('[Alias] Item:', itemForAliasListing?.id)
    console.log('[Alias] Catalog:', aliasMatchSuggestion?.catalogId)
    console.log('[Alias] Stack trace:', new Error().stack)
    console.log('═══════════════════════════════════════')

    if (!itemForAliasListing || !aliasMatchSuggestion) {
      console.error('[Alias] handleSetPrice: Missing required data', {
        hasItem: !!itemForAliasListing,
        hasSuggestion: !!aliasMatchSuggestion,
      })
      return
    }

    setAliasListingLoading(true)

    try {
      await createAliasListingForItem(
        itemForAliasListing,
        aliasMatchSuggestion.catalogId,
        aliasMatchSuggestion.catalogItem,
        priceGBP
      )
    } catch (error) {
      console.error('[Alias] Error creating listing:', error)
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create listing',
        variant: 'error',
      })
    } finally {
      setAliasListingLoading(false)
      setSetPriceModalOpen(false)
      setItemForAliasListing(null)
      setAliasMatchSuggestion(null)
    }
  }

  const createAliasListingForItem = async (item: EnrichedLineItem, catalogId: string, catalogItem?: any, priceGBP?: number) => {
    try {
      // CRITICAL: priceGBP MUST be provided by user - no automatic pricing allowed
      if (!priceGBP || priceGBP <= 0) {
        throw new Error('Price must be set by user before creating listing')
      }

      // If catalogItem not provided, fetch it to get size_unit
      let sizeUnit = 'SIZE_UNIT_US' // Default fallback
      if (!catalogItem) {
        console.log('[Alias] Fetching catalog item for size_unit:', catalogId)
        const catalogResponse = await fetch(`/api/alias/catalog/${catalogId}`)
        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json()
          sizeUnit = catalogData.item?.size_unit || 'SIZE_UNIT_US'
          console.log('[Alias] Got size_unit from catalog:', sizeUnit)
        }
      } else {
        sizeUnit = catalogItem.size_unit || 'SIZE_UNIT_US'
        console.log('[Alias] Using size_unit from catalogItem:', sizeUnit)
      }

      // Convert user's price from GBP to cents
      const priceCents = Math.round(priceGBP * 100)

      // Use catalog's size_unit (matches what Alias expects for this product)
      const listingData = {
        catalog_id: catalogId,
        price_cents: priceCents,
        size: parseFloat(item.size_uk), // Convert string to number
        size_unit: sizeUnit, // Use catalog's size_unit
        condition: 'CONDITION_NEW', // Alias API enum value
        packaging_condition: 'PACKAGING_CONDITION_GOOD_CONDITION',
        activate: true, // Activate immediately
        inventory_id: item.id,
      }

      console.log('[Alias] Creating listing with data:', listingData)

      const createResponse = await fetch('/api/alias/listings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        console.error('[Alias] Create listing API error:', errorData)
        throw new Error(errorData.error || errorData.message || 'Failed to create listing')
      }

      const createData = await createResponse.json()

      setToast({
        message: 'Alias listing created successfully',
        variant: 'success',
      })

      // Refetch inventory to show updated data
      refetch()
    } catch (error) {
      console.error('[Alias] Error creating listing:', error)
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create Alias listing',
        variant: 'error',
      })
    } finally {
      setAliasListingLoading(false)
      setItemForAliasListing(null)
      setAliasMatchSuggestion(null)
    }
  }

  const handleEditAliasListing = (item: EnrichedLineItem) => {
    // TODO: Implement Edit Alias listing
    console.log('Edit Alias listing:', item.sku)
  }

  const handleCancelAliasListing = (item: EnrichedLineItem) => {
    // TODO: Implement Cancel Alias listing
    console.log('Cancel Alias listing:', item.sku)
  }

  // Status action handlers
  const handleAddToSellList = (item: EnrichedLineItem) => {
    setSelectedItemsForSellList([item.id])
    setSellListModalOpen(true)
  }

  const handleMarkListed = (item: EnrichedLineItem) => {
    // TODO: Implement mark as listed
    console.log('Mark as listed:', item.sku)
  }

  const handleMarkUnlisted = (item: EnrichedLineItem) => {
    // TODO: Implement mark as unlisted
    console.log('Mark as unlisted:', item.sku)
  }

  const handleTogglePersonals = (item: EnrichedLineItem) => {
    // TODO: Implement toggle personals
    console.log('Toggle personals:', item.sku)
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
    } catch (error) {
      console.error('Error deleting item:', error)
      alert(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleBulkDelete = async () => {
    const selectedCount = selectedItems.size
    if (selectedCount === 0) return

    // Get selected item names for confirmation
    const itemsToDelete = filteredItems.filter(item => selectedItems.has(item.id))
    const itemNames = itemsToDelete.slice(0, 5).map(i => `${i.brand} ${i.model} (${i.sku})`).join('\n')
    const moreCount = selectedCount > 5 ? `\n...and ${selectedCount - 5} more` : ''

    if (!confirm(`Are you sure you want to permanently delete ${selectedCount} item${selectedCount > 1 ? 's' : ''}?\n\n${itemNames}${moreCount}\n\nThis will remove all items and their associated data (expenses, listings, etc.). This action cannot be undone.`)) {
      return
    }

    try {
      // Delete all selected items
      const deletePromises = itemsToDelete.map(item =>
        fetch(`/api/items/${item.id}/delete`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error(`Failed to delete ${item.sku}`)
            return res
          })
      )

      await Promise.all(deletePromises)

      // Clear selection and refetch
      setSelectedItems(new Set())
      refetch()
    } catch (error) {
      console.error('Error deleting items:', error)
      alert(`Failed to delete some items: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Active filter count
  const activeFilterCount =
    (selectedStatus.length > 0 ? 1 : 0) +
    (selectedCategory.length > 0 && selectedCategory[0] !== 'sneaker' ? 1 : 0) +
    (selectedSize.length > 0 ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (quickFilter ? 1 : 0)

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
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold text-fg tracking-tight mb-2">
            Portfolio
          </h1>
          <p className="text-sm text-fg/70 max-w-2xl">
            Track and manage your collectibles inventory with live market data
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Saved Views */}
          {savedViews.views.map((view) => (
            <SavedViewChip
              key={view.id}
              label={view.name}
              active={savedViews.activeViewId === view.id}
              onApply={() => applySavedView(view.id)}
              onDelete={() => savedViews.deleteView(view.id)}
            />
          ))}

          {/* Primary Action */}
          <Button
            onClick={() => setAddItemModalOpen(true)}
            size="default"
            className="bg-[#00FF94] hover:bg-[#00E085] text-black font-medium transition-all duration-120 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="transition-boutique shadow-soft border-border hover:border-[#00FF94]/60"
                disabled={items.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#0E1A15] border-[#15251B] p-2">
              <div className="text-xs font-medium text-[#7FA08F] uppercase tracking-wide px-2 py-1.5">
                Export Options
              </div>
              <DropdownMenuItem
                onClick={exportCSV}
                disabled={filteredItems.length === 0}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Inventory
                <span className="ml-auto text-xs text-[#7FA08F]">CSV</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />
              <DropdownMenuItem
                onClick={() => exportInsuranceCsv(items as any)}
                disabled={items.length === 0}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                <Shield className="h-4 w-4 mr-2" />
                Insurance Report
                <span className="ml-auto text-xs text-[#7FA08F]">CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportTaxCsv(items as any)}
                disabled={items.length === 0}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Tax Report
                <span className="ml-auto text-xs text-[#7FA08F]">CSV</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Bar - Sticky */}
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-4 bg-bg/95 backdrop-blur-lg border-y border-border/40">
        <div className="flex flex-col gap-5">
          {/* Search + Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
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
                  'pl-9 bg-elev-0 border-border transition-all duration-120 text-fg',
                  searchQuery && 'ring-2 ring-[#00FF94]/35 border-[#00FF94]/35'
                )}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FilterTabs
                tabs={statusTabs}
                value={selectedStatus}
                onChange={(keys) => updateParams({ status: keys })}
                multiselect
              />
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border/40" />

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <FilterTabs
                tabs={categoryTabs}
                value={selectedCategory}
                onChange={(keys) => updateParams({ category: keys.length > 0 ? keys : ['sneaker'] })}
                multiselect={false}
              />
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#00FF94]/85 uppercase tracking-wide mr-0.5">Quick Filters:</span>
            <Button
              variant={quickFilter === 'listed-stockx' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('listed-stockx')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'listed-stockx'
                  ? 'bg-[#00FF94] text-black hover:bg-[#00E085] shadow-lg'
                  : 'border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10 hover:border-[#00FF94]/50 hover:shadow-[0_0_8px_rgba(0,255,148,0.15)]'
              )}
            >
              Listed on StockX
            </Button>
            <Button
              variant={quickFilter === 'profitable' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('profitable')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'profitable'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:shadow-[0_0_8px_rgba(16,185,129,0.15)]'
              )}
            >
              Profitable
            </Button>
            <Button
              variant={quickFilter === 'loss-making' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('loss-making')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'loss-making'
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
                  : 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:shadow-[0_0_8px_rgba(239,68,68,0.15)]'
              )}
            >
              Loss Making
            </Button>
            <Button
              variant={quickFilter === 'never-listed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('never-listed')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'never-listed'
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                  : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 hover:shadow-[0_0_8px_rgba(59,130,246,0.15)]'
              )}
            >
              Never Listed
            </Button>
            <Button
              variant={quickFilter === 'added-this-week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('added-this-week')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'added-this-week'
                  ? 'bg-amber-500 text-black hover:bg-amber-600 shadow-lg'
                  : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 hover:shadow-[0_0_8px_rgba(245,158,11,0.15)]'
              )}
            >
              Added This Week
            </Button>
          </div>

          {/* Actions Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setQuickFilter(null)
                    updateParams({ status: [], category: ['sneaker'], size_uk: [], search: undefined })
                  }}
                  className="text-xs text-muted hover:text-fg"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  className="border-border max-md:hidden border-[#00FF94]/40 text-[#00FF94] hover:bg-[#00FF94]/10 hover:border-[#00FF94] font-semibold transition-all duration-120"
                  onClick={() => {
                    const name = prompt('Enter a name for this view:')
                    if (name) saveCurrentView(name)
                  }}
                  size="sm"
                >
                  <Bookmark className="h-4 w-4 mr-2" /> Save View
                </Button>
              )}
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

      {/* Sync Toolbar & Column Chooser */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        {/* Last Synced Indicator */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted" />
          <span className="text-muted">Last synced:</span>
          <span className="font-medium mono text-fg">
            {(() => {
              const timestamp = items[0]?.stockx?.lastSyncSuccessAt
              if (!timestamp) return 'Never synced'

              const date = new Date(timestamp)
              const now = new Date()
              const diffMs = now.getTime() - date.getTime()
              const diffMinutes = Math.floor(diffMs / 60000)
              const diffHours = Math.floor(diffMs / 3600000)
              const diffDays = Math.floor(diffMs / 86400000)

              if (diffMinutes < 1) return 'Just now'
              if (diffMinutes < 60) return `${diffMinutes}m ago`
              if (diffHours < 24) return `${diffHours}h ago`
              if (diffDays === 1) return 'Yesterday'
              if (diffDays < 7) return `${diffDays}d ago`

              return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            })()}
          </span>
        </div>

        {/* Sync Status Badge */}
        {syncResult === 'success' && (
          <div className="flex items-center gap-1.5 text-[#00FF94] text-sm animate-in fade-in slide-in-from-right-2 duration-200">
            <CheckCircle2 className="h-4 w-4" />
            <span>Synced successfully</span>
          </div>
        )}

        {syncResult === 'error' && (
          <div className="flex items-center gap-1.5 text-red-500 text-sm animate-in fade-in slide-in-from-right-2 duration-200">
            <AlertCircle className="h-4 w-4" />
            <span>Sync failed - try again</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Right side: Column Chooser + Sync Button */}
        <div className="flex items-center gap-2">
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

          <Button
            onClick={async () => {
              try {
                setSyncing(true)
                setSyncResult(null)

                // Use different endpoint based on platform
                const endpoint = platform === 'alias'
                  ? '/api/alias/sync/inventory'
                  : '/api/stockx/sync/inventory'

                const requestBody = platform === 'alias'
                  ? { limit: 100 }
                  : { mode: 'mapped-only', limit: 100 }

                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody),
                })

                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Sync failed')
                }

                const result = await response.json()
                console.log(`[${platform.toUpperCase()} Sync] Completed:`, result)

                refetch()
                setSyncResult('success')

                // Clear success message after 3 seconds
                setTimeout(() => setSyncResult(null), 3000)
              } catch (error) {
                console.error('Sync failed:', error)
                setSyncResult('error')

                // Clear error message after 5 seconds
                setTimeout(() => setSyncResult(null), 5000)
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            size="sm"
            className={cn(
              platform === 'alias'
                ? 'bg-[#A855F7] hover:bg-[#9333EA] text-white'
                : 'bg-[#00FF94] hover:bg-[#00E085] text-black',
              'font-medium transition-all duration-120 shadow-soft gap-2',
              syncing && 'cursor-wait opacity-75'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            <span>{syncing ? 'Syncing...' : `Sync ${platform === 'alias' ? 'Alias' : 'StockX'}`}</span>
          </Button>
        </div>
      </div>

      {/* Platform Switcher */}
      <div className="mb-6">
        <Tabs value={platform} onValueChange={(value) => setPlatform(value as 'stockx' | 'alias')}>
          <TabsList className="bg-transparent border-0 gap-2 p-0">
            <TabsTrigger
              value="stockx"
              className={cn(
                "rounded-full px-5 py-2 font-medium transition-all duration-200",
                "bg-[#00FF94] text-black",
                platform === 'stockx'
                  ? "opacity-100"
                  : "opacity-30 hover:opacity-50"
              )}
            >
              StockX
            </TabsTrigger>
            <TabsTrigger
              value="alias"
              className={cn(
                "rounded-full px-5 py-2 font-medium transition-all duration-200",
                "bg-[#A855F7] text-white",
                platform === 'alias'
                  ? "opacity-100"
                  : "opacity-30 hover:opacity-50"
              )}
            >
              Alias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Bulk Actions Toolbar - Updated */}
      <div className={cn(
        "sticky top-0 z-10 rounded-xl p-4 mb-4 shadow-lg transition-all duration-200 border-t border-[#00FF94]/8",
        selectedItems.size > 0
          ? "bg-gradient-to-br from-[#00FF94]/20 to-[#00FF94]/5 border-2 border-[#00FF94]/40 shadow-xl shadow-[#00FF94]/10"
          : "bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10"
      )}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {selectedItems.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-fg">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                  className="text-xs"
                >
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted">
                Select items using checkboxes to enable bulk actions
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedItems.size === 0}
              onClick={() => {
                const selectedData = filteredItems.filter(item => selectedItems.has(item.id))
                const csv = [
                  ['SKU', 'Brand', 'Model', 'Size', 'Cost', 'Market', 'P&L'].join(','),
                  ...selectedData.map(item => [
                    item.sku,
                    item.brand,
                    item.model,
                    item.size_uk,
                    item.invested,
                    item.market?.price || 0,
                    (item.market?.price || 0) - (item.invested || 0)
                  ].join(','))
                ].join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `selected-items-${new Date().toISOString().split('T')[0]}.csv`
                a.click()
              }}
              className="text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 font-semibold transition-all duration-120"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>

            <Button
              size="sm"
              disabled={selectedItems.size === 0}
              onClick={() => setBulkListModalOpen(true)}
              className="text-xs bg-[#00FF94] hover:bg-[#00E085] text-black font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              List on StockX
            </Button>

            <Button
              size="sm"
              disabled={selectedItems.size === 0}
              onClick={() => {
                setSelectedItemsForSellList(Array.from(selectedItems))
                setSellListModalOpen(true)
              }}
              className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-120"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add to Sell List
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={selectedItems.size === 0}
              onClick={handleBulkDelete}
              className="text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 font-semibold transition-all duration-120"
            >
              Delete {selectedItems.size > 0 ? selectedItems.size : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* Inventory V3 Table */}
      <InventoryV3Table
        items={filteredItems}
        loading={loading}
        sorting={sorting}
        onSortingChange={setSorting}
        platform={platform}
        onRowClick={handleRowClick}
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        // Item actions
        onEdit={handleEdit}
        onDuplicate={handleDuplicateItem}
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
        onPlaceAliasListing={handlePlaceAliasListing}
        onEditAliasListing={handleEditAliasListing}
        onCancelAliasListing={handleCancelAliasListing}
        // Status actions
        onAddToWatchlist={handleAddToWatchlist}
        onAddToSellList={handleAddToSellList}
        onMarkListed={handleMarkListed}
        onMarkSold={handleToggleSold}
        onMarkUnlisted={handleMarkUnlisted}
        onTogglePersonals={handleTogglePersonals}
        onAddExpense={handleAddExpense}
      />

      {/* Add Item Modal */}
      <AddItemModal
        open={addItemModalOpen}
        onOpenChange={handleAddItemModalChange}
        onSuccess={handleItemAdded}
        editItem={editItem}
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

      {/* Add to Sell List Modal */}
      <AddToSellListModal
        isOpen={sellListModalOpen}
        onClose={() => {
          setSellListModalOpen(false)
          setSelectedItemsForSellList([])
        }}
        inventoryItemIds={selectedItemsForSellList}
        onSuccess={() => {
          // Clear selection and show success
          setSelectedItems(new Set())
          alert('Items added to sell list successfully!')
        }}
      />

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
          item={itemToList}
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

      {/* Bulk List on StockX Modal */}
      <BulkListOnStockXModal
        open={bulkListModalOpen}
        onClose={() => setBulkListModalOpen(false)}
        onSuccess={() => {
          refetch()
          setBulkListModalOpen(false)
          setSelectedItems(new Set())
        }}
        items={filteredItems.filter(item => selectedItems.has(item.id))}
      />

      {/* Confirm Alias Match Modal */}
      {itemForAliasListing && aliasMatchSuggestion && (
        <ConfirmAliasMatchModal
          open={confirmAliasMatchOpen}
          onClose={() => {
            setConfirmAliasMatchOpen(false)
            setItemForAliasListing(null)
            setAliasMatchSuggestion(null)
            setAliasListingLoading(false)
          }}
          onConfirm={handleConfirmAliasMatch}
          inventorySku={itemForAliasListing.sku}
          inventoryName={`${itemForAliasListing.brand} ${itemForAliasListing.model}`}
          suggestion={aliasMatchSuggestion}
          loading={aliasListingLoading}
        />
      )}

      {/* Set Price Modal */}
      {itemForAliasListing && aliasMatchSuggestion && (
        <SetPriceModal
          open={setPriceModalOpen}
          onOpenChange={(open) => {
            setSetPriceModalOpen(open)
            if (!open) {
              setItemForAliasListing(null)
              setAliasMatchSuggestion(null)
              setAliasListingLoading(false)
            }
          }}
          onConfirm={handleSetPrice}
          productName={`${itemForAliasListing.brand} ${itemForAliasListing.model}`}
          imageUrl={itemForAliasListing.alias_image_url || itemForAliasListing.image?.url || itemForAliasListing.stockx_image_url || itemForAliasListing.image_url}
          marketPrice={itemForAliasListing.alias?.lowestAsk || itemForAliasListing.market?.price}
          loading={aliasListingLoading}
        />
      )}

      {/* No Alias Match Modal */}
      {itemForAliasListing && (
        <NoAliasMatchModal
          open={noAliasMatchOpen}
          onClose={() => {
            setNoAliasMatchOpen(false)
            setItemForAliasListing(null)
          }}
          inventorySku={itemForAliasListing.sku}
          inventoryName={`${itemForAliasListing.brand} ${itemForAliasListing.model}`}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
