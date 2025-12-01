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
import { Search, Download, Plus, Bookmark, ChevronDown, FileText, Shield, Receipt, Clock, RefreshCw, CheckCircle2, AlertCircle, TrendingUp, PauseCircle, PlayCircle, Trash2, Columns, MoreHorizontal } from 'lucide-react'
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
import { BulkRepriceModal } from './_components/BulkRepriceModal'
import { BulkOperationProgressModal, type BulkOperationResult } from './_components/BulkOperationProgressModal'
import { BulkActionsSheet } from './_components/BulkActionsSheet'

// Mobile Components
import { MobileInventoryList } from './_components/mobile/MobileInventoryList'

// Hooks
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Bulk operations
import { bulkPauseListings, bulkActivateListings, bulkRepriceListings, type BulkListingItem } from '@/lib/services/stockx/bulkListings'
import { toast } from 'sonner'

export default function PortfolioPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Detect mobile breakpoint
  const isMobile = useMediaQuery('(max-width: 768px)')

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
    { key: 'name', label: 'Name', visible: true, lock: true },
    { key: 'size', label: 'Size (UK)', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'unrealised_pl', label: 'Unrealised P/L', visible: true },
    { key: 'invested', label: 'Purchase Price', visible: true },
    { key: 'market_value', label: 'Market Value', visible: true },
    { key: 'highest_bid', label: 'Highest Bid', visible: true },
    { key: 'listed_price', label: 'Listed Price', visible: true },
    { key: 'spread', label: 'Spread %', visible: false },
    { key: 'performance_pct', label: 'Performance %', visible: true },
    { key: 'platform', label: 'Platform', visible: true },
    { key: 'purchase_date', label: 'Purchase Date', visible: false },
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

  // Bulk operations state
  const [bulkRepriceModalOpen, setBulkRepriceModalOpen] = useState(false)
  const [bulkProgressModalOpen, setBulkProgressModalOpen] = useState(false)
  const [currentBulkOperation, setCurrentBulkOperation] = useState<'pause' | 'activate' | 'reprice'>('pause')
  const [bulkOperationResult, setBulkOperationResult] = useState<BulkOperationResult>({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    inProgress: false,
    errors: []
  })

  // Mobile bulk actions sheet state
  const [bulkActionsSheetOpen, setBulkActionsSheetOpen] = useState(false)

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

  // Bulk StockX action handlers
  const getSelectedItemsWithListings = (): BulkListingItem[] => {
    const selected = filteredItems.filter(item => selectedItems.has(item.id))
    return selected.map(item => ({
      id: item.id,
      stockxListingId: item.stockx?.listingId || null,
      sku: item.sku,
      productName: `${item.brand} ${item.model}`
    }))
  }

  const handleBulkPause = () => {
    const items = getSelectedItemsWithListings()
    const eligible = items.filter(i => i.stockxListingId)
    const skipped = items.length - eligible.length

    if (eligible.length > 50) {
      toast.error('Bulk action limited to 50 listings at a time. Please select fewer items.')
      return
    }

    if (eligible.length === 0) {
      toast.error('No items with StockX listings selected.')
      return
    }

    setCurrentBulkOperation('pause')
    setBulkOperationResult({
      total: eligible.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped,
      inProgress: true,
      errors: []
    })
    setBulkProgressModalOpen(true)

    bulkPauseListings(eligible, (progress) => {
      setBulkOperationResult({
        ...progress,
        skipped,
        inProgress: progress.processed < progress.total
      })
    }).then((finalResult) => {
      setBulkOperationResult({
        ...finalResult,
        skipped,
        inProgress: false
      })
      refetch()
      setSelectedItems(new Set())
    })
  }

  const handleBulkActivate = () => {
    const items = getSelectedItemsWithListings()
    const eligible = items.filter(i => i.stockxListingId)
    const skipped = items.length - eligible.length

    if (eligible.length > 50) {
      toast.error('Bulk action limited to 50 listings at a time. Please select fewer items.')
      return
    }

    if (eligible.length === 0) {
      toast.error('No items with StockX listings selected.')
      return
    }

    setCurrentBulkOperation('activate')
    setBulkOperationResult({
      total: eligible.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped,
      inProgress: true,
      errors: []
    })
    setBulkProgressModalOpen(true)

    bulkActivateListings(eligible, (progress) => {
      setBulkOperationResult({
        ...progress,
        skipped,
        inProgress: progress.processed < progress.total
      })
    }).then((finalResult) => {
      setBulkOperationResult({
        ...finalResult,
        skipped,
        inProgress: false
      })
      refetch()
      setSelectedItems(new Set())
    })
  }

  const handleBulkRepriceOpen = () => {
    const items = getSelectedItemsWithListings()
    const eligible = items.filter(i => i.stockxListingId)

    if (eligible.length > 50) {
      toast.error('Bulk action limited to 50 listings at a time. Please select fewer items.')
      return
    }

    if (eligible.length === 0) {
      toast.error('No items with StockX listings selected.')
      return
    }

    setBulkRepriceModalOpen(true)
  }

  const handleBulkRepriceConfirm = (askPrice: number) => {
    const items = getSelectedItemsWithListings()
    const eligible = items.filter(i => i.stockxListingId)
    const skipped = items.length - eligible.length

    setBulkRepriceModalOpen(false)
    setCurrentBulkOperation('reprice')
    setBulkOperationResult({
      total: eligible.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped,
      inProgress: true,
      errors: []
    })
    setBulkProgressModalOpen(true)

    bulkRepriceListings(eligible, askPrice, (progress) => {
      setBulkOperationResult({
        ...progress,
        skipped,
        inProgress: progress.processed < progress.total
      })
    }).then((finalResult) => {
      setBulkOperationResult({
        ...finalResult,
        skipped,
        inProgress: false
      })
      refetch()
      setSelectedItems(new Set())
    })
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
        size: parseFloat(String(item.size_uk ?? '')), // Convert string to number
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

  // Convert columnConfig to columnVisibility object for InventoryV3Table
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
    <div className="mx-auto max-w-[1400px] px-3 md:px-6 lg:px-8 py-2 md:py-4 space-y-2 md:space-y-3 text-fg">
      {/* Compact Page Header */}
      <div className="flex items-center justify-between gap-4 py-2">
        {/* Left: Title + Subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl md:text-2xl font-semibold text-fg tracking-tight">
            Portfolio
          </h1>
          <p className="text-[11px] text-muted/70 max-w-2xl hidden md:block mt-0.5">
            Track and manage your collectibles inventory with live market data
          </p>
        </div>

        {/* Right: Action Buttons */}
        <div className="hidden md:flex items-center gap-2">
          {/* Sync Button */}
          <Button
            onClick={async () => {
              setSyncing(true)
              setSyncResult(null)
              try {
                const endpoint = platform === 'alias' ? '/api/alias/sync/inventory' : '/api/stockx/sync-all'
                const requestBody = platform === 'alias' ? { limit: 100 } : {}
                const res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                })
                if (!res.ok) throw new Error('Sync failed')
                setSyncResult('success')
                setTimeout(() => setSyncResult(null), 3000)
                void refetch()
              } catch (error) {
                console.error('Sync error:', error)
                setSyncResult('error')
                setTimeout(() => setSyncResult(null), 3000)
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs border-border/60 hover:border-border text-muted hover:text-fg"
          >
            <RefreshCw className={cn('h-3 w-3 mr-1.5', syncing && 'animate-spin')} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>

          {/* Add Item */}
          <Button
            onClick={() => setAddItemModalOpen(true)}
            size="sm"
            className="h-8 px-3 text-xs bg-[#00FF94] hover:bg-[#00E085] text-black font-medium"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Item
          </Button>

          {/* Column Chooser */}
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

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs border-border/60 hover:border-border text-muted hover:text-fg"
              >
                <Download className="h-3 w-3 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => console.log('Export CSV')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Export JSON')}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="-mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-3 bg-elev-0/30 border-y border-border/20">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 overflow-x-auto">
          {/* Search - Match top bar style */}
          <div className="relative flex-shrink-0 w-[280px] md:w-[360px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/70" />
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
                'pl-9 pr-3 h-10 bg-elev-1/50 border border-white/10 rounded-lg transition-all text-fg text-sm',
                'hover:bg-elev-2/80 hover:border-accent/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-sm',
                searchQuery && 'ring-2 ring-[#00FF94]/30 border-[#00FF94]/30'
              )}
            />
          </div>

            {/* Quick Filters - Premium style with emojis */}
            <Button
              onClick={() => applyQuickFilter('listed-stockx')}
              className={cn(
                'h-10 px-3.5 text-xs font-medium transition-all flex-shrink-0 rounded-lg gap-1.5 border',
                quickFilter === 'listed-stockx'
                  ? '!bg-[#00FF94]/15 !text-[#00FF94] !border-[#00FF94]/30 hover:!bg-[#00FF94]/25 !shadow-sm'
                  : '!bg-elev-1/50 !border-white/10 !text-muted hover:!bg-elev-2/80 hover:!text-fg hover:!border-accent/30'
              )}
            >
              <span>🏷️</span>
              Listed on StockX
            </Button>
            <Button
              onClick={() => applyQuickFilter('profitable')}
              className={cn(
                'h-10 px-3.5 text-xs font-medium transition-all flex-shrink-0 rounded-lg gap-1.5 border',
                quickFilter === 'profitable'
                  ? '!bg-emerald-500/15 !text-emerald-400 !border-emerald-500/30 hover:!bg-emerald-500/25 !shadow-sm'
                  : '!bg-elev-1/50 !border-white/10 !text-muted hover:!bg-elev-2/80 hover:!text-fg hover:!border-accent/30'
              )}
            >
              <span>💰</span>
              Profitable
            </Button>
            <Button
              onClick={() => applyQuickFilter('loss-making')}
              className={cn(
                'h-10 px-3.5 text-xs font-medium transition-all flex-shrink-0 rounded-lg gap-1.5 border',
                quickFilter === 'loss-making'
                  ? '!bg-red-500/15 !text-red-400 !border-red-500/30 hover:!bg-red-500/25 !shadow-sm'
                  : '!bg-elev-1/50 !border-white/10 !text-muted hover:!bg-elev-2/80 hover:!text-fg hover:!border-accent/30'
              )}
            >
              <span>📉</span>
              Loss Making
            </Button>
            <Button
              onClick={() => applyQuickFilter('never-listed')}
              className={cn(
                'h-10 px-3.5 text-xs font-medium transition-all flex-shrink-0 rounded-lg gap-1.5 border',
                quickFilter === 'never-listed'
                  ? '!bg-blue-500/15 !text-blue-400 !border-blue-500/30 hover:!bg-blue-500/25 !shadow-sm'
                  : '!bg-elev-1/50 !border-white/10 !text-muted hover:!bg-elev-2/80 hover:!text-fg hover:!border-accent/30'
              )}
            >
              <span>📦</span>
              Never Listed
            </Button>
            <Button
              onClick={() => applyQuickFilter('added-this-week')}
              className={cn(
                'h-10 px-3.5 text-xs font-medium transition-all flex-shrink-0 rounded-lg gap-1.5 border',
                quickFilter === 'added-this-week'
                  ? '!bg-amber-500/15 !text-amber-400 !border-amber-500/30 hover:!bg-amber-500/25 !shadow-sm'
                  : '!bg-elev-1/50 !border-white/10 !text-muted hover:!bg-elev-2/80 hover:!text-fg hover:!border-accent/30'
              )}
            >
              <span>⏰</span>
              Added This Week
            </Button>
          </div>

          {/* Optional Second Row: Clear Filters / Save View */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setQuickFilter(null)
                  updateParams({ status: [], category: ['sneaker'], size_uk: [], search: undefined })
                }}
                className="h-7 text-xs text-muted hover:text-fg"
              >
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
              </Button>

              <Button
                variant="outline"
                className="h-7 text-xs border-[#00FF94]/40 text-[#00FF94] hover:bg-[#00FF94]/10 hover:border-[#00FF94]"
                onClick={() => {
                  const name = prompt('Enter a name for this view:')
                  if (name) saveCurrentView(name)
                }}
                size="sm"
              >
                <Bookmark className="h-3 w-3 mr-1.5" /> Save View
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Fetch Error Alert */}
      {fetchError && (
        <div className="border-l-4 border-l-danger bg-elev-1 p-4 rounded-lg">
          <p className="text-sm text-danger font-medium">Error: {fetchError}</p>
        </div>
      )}

      {/* Mobile Primary Actions Row - Always visible on mobile */}
      <div className="flex sm:hidden gap-2 mb-3">
        {/* Sync StockX */}
        <Button
          onClick={async () => {
            setSyncing(true)
            setSyncResult(null)
            try {
              const endpoint = platform === 'alias' ? '/api/alias/sync/inventory' : '/api/stockx/sync-all'
              const requestBody = platform === 'alias' ? { limit: 100 } : {}
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              })
              if (!res.ok) throw new Error('Sync failed')
              setSyncResult('success')
              setTimeout(() => setSyncResult(null), 3000)
              void refetch()
            } catch (error) {
              console.error('Sync error:', error)
              setSyncResult('error')
              setTimeout(() => setSyncResult(null), 3000)
            } finally {
              setSyncing(false)
            }
          }}
          disabled={syncing}
          className="flex-1 bg-[#00FF94] hover:bg-[#00E085] text-black font-semibold rounded-xl py-2"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync StockX'}
        </Button>

        {/* Add Item */}
        <Button
          onClick={() => setAddItemModalOpen(true)}
          className="flex-1 bg-soft hover:bg-soft/80 text-fg font-semibold rounded-xl py-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>

        {/* Columns */}
        <div className="flex-shrink-0">
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

        {/* More - Opens bulk actions sheet */}
        <Button
          onClick={() => setBulkActionsSheetOpen(true)}
          variant="outline"
          className="px-3 bg-soft hover:bg-soft/80 border-border rounded-xl flex items-center gap-1"
          disabled={selectedItems.size === 0}
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </Button>
      </div>

      {/* Unified Actions Toolbar - Desktop only, visible when items are selected */}
      {selectedItems.size > 0 && (
        <div className={cn(
          "hidden sm:flex sticky top-0 z-50 rounded-xl p-4 mb-4 shadow-lg transition-all duration-200 border-t border-[#00FF94]/8 overflow-x-auto",
          "bg-gradient-to-br from-[#00FF94]/8 to-[#00FF94]/2 border-2 border-[#00FF94]/20 shadow-xl shadow-[#00FF94]/5"
        )}>
          <div className="flex items-center gap-4 min-w-max">
            {/* Left: Selection info */}
            <div className="flex items-center gap-3">
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
            </div>

          {/* Export - isolated on left */}
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

          <div className="flex-1" />

          {/* Right: Main action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Add to Sell List - requires selection */}
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

            {/* Delete - requires selection */}
            <Button
              variant="outline"
              size="sm"
              disabled={selectedItems.size === 0}
              onClick={handleBulkDelete}
              className="text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 font-semibold transition-all duration-120 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete {selectedItems.size > 0 ? selectedItems.size : ''}
            </Button>

            {/* StockX-specific bulk actions - only show when items are selected on StockX tab */}
            {platform === 'stockx' && (
              <>
                {/* Reprice - requires selection */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkRepriceOpen}
                  className="text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500 font-semibold transition-all duration-120"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Reprice on StockX
                </Button>

                {/* Activate - requires selection */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkActivate}
                  className="text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 font-semibold transition-all duration-120"
                >
                  <PlayCircle className="h-3 w-3 mr-1" />
                  Activate on StockX
                </Button>

                {/* Pause - requires selection */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkPause}
                  className="text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500 font-semibold transition-all duration-120"
                >
                  <PauseCircle className="h-3 w-3 mr-1" />
                  Pause on StockX
                </Button>

                {/* List on StockX - requires selection */}
                <Button
                  size="sm"
                  onClick={() => setBulkListModalOpen(true)}
                  className="text-xs bg-[#00FF94] hover:bg-[#00E085] text-black font-semibold shadow-lg transition-all duration-120"
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  List on StockX
                </Button>
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Platform Tabs - Premium selectors */}
      <div className="-mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 pt-3 pb-0">
        <Tabs value={platform} onValueChange={(value) => setPlatform(value as 'stockx' | 'alias')}>
          <TabsList className="bg-transparent border-0 gap-2 p-0 h-auto">
            <TabsTrigger
              value="stockx"
              className={cn(
                "relative px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-lg border",
                "data-[state=active]:shadow-sm",
                platform === 'stockx'
                  ? "text-white bg-gradient-to-br from-[#00FF94]/20 to-[#00FF94]/10 border-[#00FF94]/30 shadow-[0_0_20px_rgba(0,255,148,0.15)]"
                  : "text-muted border-white/10 bg-elev-1/50 hover:text-fg hover:bg-elev-2/80 hover:border-accent/30"
              )}
            >
              StockX
            </TabsTrigger>
            <TabsTrigger
              value="alias"
              className={cn(
                "relative px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-lg border",
                "data-[state=active]:shadow-sm",
                platform === 'alias'
                  ? "text-white bg-gradient-to-br from-[#A855F7]/20 to-[#A855F7]/10 border-[#A855F7]/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                  : "text-muted border-white/10 bg-elev-1/50 hover:text-fg hover:bg-elev-2/80 hover:border-[#A855F7]/30"
              )}
            >
              Alias
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Mobile vs Desktop View */}
      {isMobile ? (
        /* Mobile Card View */
        <MobileInventoryList
          items={filteredItems}
          loading={loading}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          onRefetch={refetch}
          // StockX action handlers
          onListOnStockX={handleListOnStockX}
          onRepriceListing={handleRepriceListing}
          onDeactivateListing={handleDeactivateListing}
          onReactivateListing={handleReactivateListing}
          onDeleteItem={handleDeleteItem}
          // Bulk action handlers
          onBulkList={() => setBulkListModalOpen(true)}
          onBulkPause={handleBulkPause}
          onBulkActivate={handleBulkActivate}
          onBulkReprice={handleBulkRepriceOpen}
          onBulkDelete={handleBulkDelete}
          onBulkExport={() => {
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
        />
      ) : (
        /* Desktop Table View */
        <InventoryV3Table
          items={filteredItems}
          loading={loading}
          sorting={sorting}
          onSortingChange={setSorting}
          platform={platform}
          columnVisibility={columnVisibility}
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
      )}

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
          imageUrl={itemForAliasListing.alias_image_url || itemForAliasListing.image?.url || itemForAliasListing.stockx_image_url || itemForAliasListing.image_url || undefined}
          marketPrice={itemForAliasListing.alias?.lowestAsk || itemForAliasListing.market?.price || undefined}
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

      {/* Bulk Reprice Modal */}
      <BulkRepriceModal
        open={bulkRepriceModalOpen}
        onClose={() => setBulkRepriceModalOpen(false)}
        onConfirm={handleBulkRepriceConfirm}
        listingCount={getSelectedItemsWithListings().filter(i => i.stockxListingId).length}
      />

      {/* Bulk Operation Progress Modal */}
      <BulkOperationProgressModal
        open={bulkProgressModalOpen}
        onClose={() => setBulkProgressModalOpen(false)}
        operation={currentBulkOperation}
        result={bulkOperationResult}
      />

      {/* Mobile Bulk Actions Sheet */}
      <BulkActionsSheet
        open={bulkActionsSheetOpen}
        onOpenChange={setBulkActionsSheetOpen}
        selectedCount={selectedItems.size}
        platform={platform}
        onBulkList={() => setBulkListModalOpen(true)}
        onBulkPause={handleBulkPause}
        onBulkActivate={handleBulkActivate}
        onBulkReprice={handleBulkRepriceOpen}
        onBulkAddToSellList={() => {
          setSelectedItemsForSellList(Array.from(selectedItems))
          setSellListModalOpen(true)
        }}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  )
}
