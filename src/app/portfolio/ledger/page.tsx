'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSalesTable, exportSalesToCSV } from '@/hooks/useSalesTable'
import { useLedger, exportLedgerToCSV, type LedgerRow } from '@/hooks/useLedger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Download, ChevronDown, RefreshCw, DollarSign, Package, LayoutGrid, List
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { SalesTable } from './_components/SalesTable'
import { LedgerTable } from './_components/LedgerTable'
import { RevenueChart } from './_components/RevenueChart'
import { PlatformBreakdown } from './_components/PlatformBreakdown'
import { RecentActivity } from './_components/RecentActivity'
import type { SortingState } from '@tanstack/react-table'

// Available years for filtering
const AVAILABLE_YEARS = [2024, 2025, 2026].filter(y => y <= new Date().getFullYear() + 1)

// Page size for pagination
const PAGE_SIZE = 20

// Tab types
type TabType = 'overview' | 'ledger'

// Transaction types for ledger filter
type TransactionType = 'ALL' | 'BUY' | 'SELL'

export default function LedgerPage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { convert, format } = useCurrency()

  // Tab state from URL
  const activeTab = (searchParams.get('tab') as TabType) || 'overview'

  // Core state
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '')
  const [selectedPlatform, setSelectedPlatform] = useState<string>(searchParams.get('platform') || '')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionType, setTransactionType] = useState<TransactionType>('ALL')

  // Platform filter tabs
  const platformTabs = [
    { key: '', label: 'All' },
    { key: 'stockx', label: 'StockX' },
    { key: 'alias', label: 'Alias' },
    { key: 'ebay', label: 'eBay' },
    { key: 'private', label: 'Private' },
    { key: 'other', label: 'Other' },
  ]

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sold_date', desc: true },
  ])

  // Calculate date filters based on year and quick filter
  const dateFilters = useMemo(() => {
    const now = new Date()

    if (quickFilter === 'this-month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        date_from: monthStart.toISOString().split('T')[0],
        date_to: undefined,
      }
    }

    if (quickFilter === 'ytd') {
      const yearStart = new Date(selectedYear, 0, 1)
      return {
        date_from: yearStart.toISOString().split('T')[0],
        date_to: selectedYear === now.getFullYear() ? undefined : `${selectedYear}-12-31`,
      }
    }

    // Default: filter by selected year
    return {
      date_from: `${selectedYear}-01-01`,
      date_to: `${selectedYear}-12-31`,
    }
  }, [selectedYear, quickFilter])

  // Fetch sales data (for Overview tab - SELL only)
  const { items: allItems, loading, error: fetchError, refetch } = useSalesTable({
    search: searchQuery || undefined,
    platform: selectedPlatform || undefined,
    date_from: dateFilters.date_from,
    date_to: dateFilters.date_to,
    sort_by: (sorting[0]?.id as 'sold_date' | 'sold_price' | 'margin_gbp' | 'margin_percent') || 'sold_date',
    sort_order: sorting[0]?.desc ? 'desc' : 'asc',
  })

  // Fetch unified ledger data (for Ledger tab - BUY + SELL)
  const {
    rows: ledgerRows,
    loading: ledgerLoading,
    error: ledgerError,
    total: ledgerTotal,
    refetch: ledgerRefetch,
  } = useLedger({
    type: transactionType,
    year: selectedYear,
    platform: selectedPlatform || undefined,
    search: searchQuery || undefined,
  })

  // Combined refetch for tab sync - when sales data changes, refresh both views
  const refetchAll = useCallback(() => {
    refetch()
    ledgerRefetch()
  }, [refetch, ledgerRefetch])

  // Apply client-side filters (profitable only)
  const filteredItems = useMemo(() => {
    if (quickFilter === 'profitable') {
      return allItems.filter(item => (item.margin_gbp || 0) > 0)
    }
    return allItems
  }, [allItems, quickFilter])

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, currentPage])

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Update URL params
  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    const query = params.toString()
    router.replace(`/portfolio/ledger${query ? `?${query}` : ''}`)
  }

  // Tab change handler
  const handleTabChange = (tab: TabType) => {
    updateParams({ tab: tab === 'overview' ? undefined : tab })
  }

  // Quick filter handlers
  const toggleQuickFilter = (filterKey: string) => {
    if (filterKey === quickFilter) {
      setQuickFilter(null)
    } else {
      setQuickFilter(filterKey)
    }
    handleFilterChange()
  }

  // Calculate KPIs from filtered data
  const kpis = useMemo(() => {
    const totalSales = filteredItems.reduce((sum, item) => sum + (item.sold_price || 0), 0)
    const totalCOGS = filteredItems.reduce((sum, item) =>
      sum + (item.purchase_price || 0) + (item.purchase_total ? item.purchase_total - (item.purchase_price || 0) : 0), 0
    )
    const totalMargin = filteredItems.reduce((sum, item) => sum + (item.margin_gbp || 0), 0)
    const avgMargin = filteredItems.length > 0
      ? filteredItems.reduce((sum, item) => sum + (item.margin_percent || 0), 0) / filteredItems.length
      : 0

    return {
      totalSales,
      totalCOGS,
      totalMargin,
      avgMargin,
      count: filteredItems.length,
    }
  }, [filteredItems])

  // Build export filename with filter context
  const getExportFilename = () => {
    const parts = ['archvd-ledger']
    parts.push(String(selectedYear))
    if (selectedPlatform) parts.push(selectedPlatform)
    if (quickFilter === 'profitable') parts.push('profitable')
    parts.push(new Date().toISOString().split('T')[0])
    return `${parts.join('-')}.csv`
  }

  // Get filter context description
  const getFilterContext = () => {
    const parts: string[] = []
    parts.push(String(selectedYear))
    if (selectedPlatform) {
      const platform = platformTabs.find(p => p.key === selectedPlatform)
      parts.push(platform?.label || selectedPlatform)
    }
    if (quickFilter === 'profitable') parts.push('Profitable')
    if (quickFilter === 'this-month') parts.push('This Month')
    if (quickFilter === 'ytd') parts.push('YTD')
    return `${filteredItems.length} sales · ${parts.join(' · ')}`
  }

  // Export CSV - different export based on active tab
  const handleExportCSV = () => {
    if (activeTab === 'ledger') {
      // Export unified ledger (BUY + SELL)
      const filename = `archvd-ledger-${selectedYear}-${transactionType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
      exportLedgerToCSV(ledgerRows, filename)
    } else {
      // Export sales only (Overview tab)
      exportSalesToCSV(filteredItems, getExportFilename())
    }
  }

  // Check if any filters are active
  const hasActiveFilters = searchQuery || selectedPlatform || quickFilter

  return (
    <div className="mx-auto max-w-[1400px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header with Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-fg tracking-tight">
            Ledger
          </h1>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-elev-0 rounded-lg p-1 border border-border/50">
            <button
              onClick={() => handleTabChange('overview')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'overview'
                  ? 'bg-accent text-black'
                  : 'text-muted hover:text-fg hover:bg-elev-1'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Overview
            </button>
            <button
              onClick={() => handleTabChange('ledger')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                activeTab === 'ledger'
                  ? 'bg-accent text-black'
                  : 'text-muted hover:text-fg hover:bg-elev-1'
              )}
            >
              <List className="h-4 w-4" />
              Ledger
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button with Context */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="border-border hover:border-accent/60"
                disabled={activeTab === 'ledger' ? ledgerRows.length === 0 : filteredItems.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-elev-1 border-border p-2">
              <div className="px-2 py-1.5 text-xs text-muted">
                {activeTab === 'ledger'
                  ? `${ledgerRows.length} transactions · ${selectedYear} · ${transactionType}`
                  : getFilterContext()
                }
              </div>
              <DropdownMenuItem
                onClick={handleExportCSV}
                disabled={activeTab === 'ledger' ? ledgerRows.length === 0 : filteredItems.length === 0}
                className="cursor-pointer"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => activeTab === 'ledger' ? ledgerRefetch() : refetch()}
            className="border-border hover:border-accent/60"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Year Selector (always visible) */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="border-border min-w-[100px]">
              {selectedYear}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-elev-1 border-border">
            {AVAILABLE_YEARS.map((year) => (
              <DropdownMenuItem
                key={year}
                onClick={() => {
                  setSelectedYear(year)
                  setQuickFilter(null)
                  handleFilterChange()
                }}
                className={cn(
                  'cursor-pointer',
                  selectedYear === year && 'bg-accent/10 text-accent'
                )}
              >
                {year}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Filters */}
        <Button
          variant={quickFilter === 'this-month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('this-month')}
          className={cn(
            'h-8 text-xs',
            quickFilter === 'this-month'
              ? 'bg-accent text-black hover:bg-accent/90'
              : 'border-accent/30 text-accent hover:bg-accent/10'
          )}
        >
          This Month
        </Button>

        <Button
          variant={quickFilter === 'ytd' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('ytd')}
          className={cn(
            'h-8 text-xs',
            quickFilter === 'ytd'
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
          )}
        >
          YTD
        </Button>

        <Button
          variant={quickFilter === 'profitable' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('profitable')}
          className={cn(
            'h-8 text-xs',
            quickFilter === 'profitable'
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
          )}
        >
          Profitable
        </Button>

        {quickFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuickFilter(null)
              handleFilterChange()
            }}
            className="h-8 text-xs text-muted hover:text-fg"
          >
            Clear
          </Button>
        )}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          {filteredItems.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Profit - Hero */}
              <div
                className="bg-elev-1 rounded-xl p-4 border-l-4"
                style={{
                  borderLeftColor: kpis.totalMargin >= 0 ? '#00FF94' : '#F87171',
                  borderColor: kpis.totalMargin >= 0 ? 'rgba(0,255,148,0.2)' : 'rgba(248,113,113,0.2)'
                }}
              >
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Profit</div>
                <div
                  className="text-2xl font-bold mono"
                  style={{ color: kpis.totalMargin >= 0 ? '#00FF94' : '#F87171' }}
                >
                  {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin, 'GBP'))}
                </div>
                <div className="text-xs text-muted mt-1">{kpis.count} sales</div>
              </div>

              {/* Revenue */}
              <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Revenue</div>
                <div className="text-xl font-semibold text-fg mono">
                  {format(convert(kpis.totalSales, 'GBP'))}
                </div>
              </div>

              {/* COGS */}
              <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
                <div className="text-xs text-muted uppercase tracking-wider mb-2">COGS</div>
                <div className="text-xl font-semibold text-fg mono">
                  {format(convert(kpis.totalCOGS, 'GBP'))}
                </div>
              </div>

              {/* Avg Profit */}
              <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
                <div className="text-xs text-muted uppercase tracking-wider mb-2">Avg Profit</div>
                <div
                  className="text-xl font-semibold mono"
                  style={{ color: kpis.totalMargin >= 0 ? '#00FF94' : '#F87171' }}
                >
                  {kpis.count > 0 ? (
                    <>
                      {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin / kpis.count, 'GBP'))}
                    </>
                  ) : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          {filteredItems.length >= 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Revenue Chart (takes 2/3) */}
              <div className="lg:col-span-2">
                <RevenueChart items={filteredItems} />
              </div>

              {/* Platform Breakdown (takes 1/3) */}
              <PlatformBreakdown items={filteredItems} />
            </div>
          )}

          {/* Recent Activity */}
          <RecentActivity
            items={filteredItems.slice(0, 10)}
            loading={loading}
            onViewAll={() => handleTabChange('ledger')}
          />

          {/* Empty State */}
          {!loading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-elev-1 rounded-full p-6 mb-4">
                <DollarSign className="h-12 w-12 text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-2">No sales recorded yet</h3>
              <p className="text-sm text-muted mb-6 text-center max-w-sm">
                When you mark items as sold in your inventory, they'll appear here with profit tracking.
              </p>
              <Button
                variant="outline"
                onClick={() => router.push('/portfolio/inventory')}
                className="border-accent text-accent hover:bg-accent/10"
              >
                <Package className="h-4 w-4 mr-2" />
                Go to Inventory
              </Button>
            </div>
          )}
        </>
      )}

      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <>
          {/* Filter Bar */}
          <div className="space-y-2">
            {/* Type Filter + Search Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter (ALL/BUY/SELL) */}
              <div className="flex items-center gap-1 bg-elev-0 rounded-lg p-1 border border-border/50">
                {(['ALL', 'BUY', 'SELL'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTransactionType(type)
                      handleFilterChange()
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      transactionType === type
                        ? type === 'BUY'
                          ? 'bg-blue-500 text-white'
                          : type === 'SELL'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-accent text-black'
                        : 'text-muted hover:text-fg hover:bg-elev-1'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  placeholder="Search SKU, brand, model..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    handleFilterChange()
                  }}
                  onBlur={() => updateParams({ search: searchQuery || undefined })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateParams({ search: searchQuery || undefined })
                    }
                  }}
                  className={cn(
                    'pl-9 bg-elev-0 border-border text-fg',
                    searchQuery && 'ring-1 ring-accent/30 border-accent/30'
                  )}
                />
              </div>

              {/* Platform Tabs (only show for SELL or ALL) */}
              {transactionType !== 'BUY' && (
                <div className="flex items-center gap-1">
                  {platformTabs.map((tab) => (
                    <Button
                      key={tab.key}
                      variant={selectedPlatform === tab.key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        setSelectedPlatform(tab.key)
                        updateParams({ platform: tab.key || undefined })
                        handleFilterChange()
                      }}
                      className={cn(
                        'h-8 text-xs font-medium',
                        selectedPlatform === tab.key
                          ? 'bg-accent text-black hover:bg-accent/90'
                          : 'text-muted hover:text-fg hover:bg-elev-1'
                      )}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Clear filters */}
              {(hasActiveFilters || transactionType !== 'ALL') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedPlatform('')
                    setQuickFilter(null)
                    setTransactionType('ALL')
                    updateParams({ search: undefined, platform: undefined })
                    handleFilterChange()
                  }}
                  className="h-8 text-xs text-muted hover:text-fg"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Transaction Count Summary */}
          {!ledgerLoading && ledgerRows.length > 0 && (
            <div className="text-sm text-muted">
              {ledgerRows.length} transaction{ledgerRows.length !== 1 ? 's' : ''}
              {transactionType !== 'ALL' && ` (${transactionType} only)`}
            </div>
          )}

          {/* Fetch Error */}
          {ledgerError && (
            <div className="border-l-4 border-l-red-500 bg-elev-1 p-4 rounded-lg">
              <p className="text-sm text-red-400">Error: {ledgerError}</p>
            </div>
          )}

          {/* Ledger Table */}
          <LedgerTable
            rows={ledgerRows}
            loading={ledgerLoading}
            sorting={sorting}
            onSortingChange={setSorting}
          />

          {/* Empty State - No transactions */}
          {!ledgerLoading && ledgerRows.length === 0 && !searchQuery && !selectedPlatform && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-elev-1 rounded-full p-6 mb-4">
                <DollarSign className="h-12 w-12 text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-2">
                {transactionType === 'BUY' ? 'No purchases recorded' :
                 transactionType === 'SELL' ? 'No sales recorded' :
                 'No transactions recorded yet'}
              </h3>
              <p className="text-sm text-muted mb-6 text-center max-w-sm">
                {transactionType === 'BUY'
                  ? 'When you add items to your inventory, their purchases will appear here.'
                  : transactionType === 'SELL'
                    ? 'When you mark items as sold, they will appear here with profit tracking.'
                    : 'Add items to your inventory and mark them as sold to see your full transaction history.'}
              </p>
              <Button
                variant="outline"
                onClick={() => router.push('/portfolio/inventory')}
                className="border-accent text-accent hover:bg-accent/10"
              >
                <Package className="h-4 w-4 mr-2" />
                Go to Inventory
              </Button>
            </div>
          )}

          {/* Empty State - No results for filters */}
          {!ledgerLoading && ledgerRows.length === 0 && (searchQuery || selectedPlatform) && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-elev-1 rounded-full p-6 mb-4">
                <Search className="h-12 w-12 text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-2">No transactions match your filters</h3>
              <p className="text-sm text-muted mb-6 text-center max-w-sm">
                Try adjusting your search or clearing filters to see more results.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedPlatform('')
                  setQuickFilter(null)
                  setTransactionType('ALL')
                  updateParams({ search: undefined, platform: undefined })
                  handleFilterChange()
                }}
                className="border-accent text-accent hover:bg-accent/10"
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
