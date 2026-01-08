'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSalesTable, exportSalesToCSV } from '@/hooks/useSalesTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Download, ChevronDown, RefreshCw, DollarSign, Package
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { SalesTable } from './_components/SalesTable'
import { RevenueChart } from './_components/RevenueChart'
import type { SortingState } from '@tanstack/react-table'

// Available years for filtering
const AVAILABLE_YEARS = [2024, 2025, 2026].filter(y => y <= new Date().getFullYear() + 1)

// Page size for pagination
const PAGE_SIZE = 20

export default function SalesPage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { convert, format } = useCurrency()

  // Core state
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '')
  const [selectedPlatform, setSelectedPlatform] = useState<string>(searchParams.get('platform') || '')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

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

  // Fetch sales data
  const { items: allItems, loading, error: fetchError, refetch } = useSalesTable({
    search: searchQuery || undefined,
    platform: selectedPlatform || undefined,
    date_from: dateFilters.date_from,
    date_to: dateFilters.date_to,
    sort_by: (sorting[0]?.id as 'sold_date' | 'sold_price' | 'margin_gbp' | 'margin_percent') || 'sold_date',
    sort_order: sorting[0]?.desc ? 'desc' : 'asc',
  })

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
    router.replace(`/portfolio/sales${query ? `?${query}` : ''}`)
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
    const parts = ['archvd-sales']
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

  // Export CSV
  const handleExportCSV = () => {
    exportSalesToCSV(filteredItems, getExportFilename())
  }

  // Check if any filters are active
  const hasActiveFilters = searchQuery || selectedPlatform || quickFilter

  return (
    <div className="mx-auto max-w-[1400px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-fg tracking-tight">
          Sales
        </h1>

        <div className="flex items-center gap-2">
          {/* Export Button with Context */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="border-border hover:border-accent/60"
                disabled={filteredItems.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-elev-1 border-border p-2">
              <div className="px-2 py-1.5 text-xs text-muted">
                {getFilterContext()}
              </div>
              <DropdownMenuItem
                onClick={handleExportCSV}
                disabled={filteredItems.length === 0}
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
            onClick={() => refetch()}
            className="border-border hover:border-accent/60"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards - Realised Gains is hero */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Realised Gains - Hero KPI */}
          <div className={cn(
            "bg-elev-1 rounded-xl p-4 border-l-4",
            kpis.totalMargin >= 0 ? "border-l-accent border-accent/20" : "border-l-red-500 border-red-500/20",
            "border border-l-4"
          )}>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Realised Gains</div>
            <div className={cn(
              "text-3xl font-bold mono",
              kpis.totalMargin >= 0 ? "text-accent" : "text-red-400"
            )}>
              {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin, 'GBP'))}
            </div>
          </div>

          {/* Total Sales - Secondary */}
          <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
            <div className="text-xs text-muted/70 uppercase tracking-wider mb-1">Total Sales</div>
            <div className="text-xl font-semibold text-fg mono">
              {format(convert(kpis.totalSales, 'GBP'))}
            </div>
          </div>

          {/* Transactions - Secondary */}
          <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
            <div className="text-xs text-muted/70 uppercase tracking-wider mb-1">Transactions</div>
            <div className="text-xl font-semibold text-fg mono">
              {kpis.count}
            </div>
          </div>

          {/* Avg Gain - Secondary */}
          <div className="bg-elev-1 border border-border/30 rounded-xl p-4">
            <div className="text-xs text-muted/70 uppercase tracking-wider mb-1">Avg Gain</div>
            <div className={cn(
              "text-xl font-semibold mono",
              kpis.avgMargin >= 0 ? "text-accent" : "text-red-400"
            )}>
              {kpis.avgMargin >= 0 ? '+' : ''}{kpis.avgMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Revenue Chart - only show with meaningful data */}
      {filteredItems.length >= 5 && (
        <RevenueChart items={filteredItems} />
      )}

      {/* Filter Bar */}
      <div className="space-y-2">
        {/* Search + Year + Platform Row */}
        <div className="flex flex-wrap items-center gap-3">
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

          {/* Year Dropdown */}
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
                    setQuickFilter(null) // Clear quick filters when changing year
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

          {/* Platform Tabs */}
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
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Button
            variant={quickFilter === 'this-month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleQuickFilter('this-month')}
            className={cn(
              'h-7 text-xs',
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
              'h-7 text-xs',
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
              'h-7 text-xs',
              quickFilter === 'profitable'
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
            )}
          >
            Profitable
          </Button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedPlatform('')
                setQuickFilter(null)
                updateParams({ search: undefined, platform: undefined })
                handleFilterChange()
              }}
              className="h-7 text-xs text-muted hover:text-fg"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="border-l-4 border-l-red-500 bg-elev-1 p-4 rounded-lg">
          <p className="text-sm text-red-400">Error: {fetchError}</p>
        </div>
      )}

      {/* Sales Table */}
      <SalesTable
        items={paginatedItems}
        loading={loading}
        sorting={sorting}
        onSortingChange={setSorting}
        onRefresh={refetch}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'h-8 w-8 p-0',
                      currentPage === pageNum && 'bg-accent text-black'
                    )}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Empty State - No sales ever */}
      {!loading && filteredItems.length === 0 && allItems.length === 0 && !hasActiveFilters && (
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

      {/* Empty State - No results for filters */}
      {!loading && filteredItems.length === 0 && (allItems.length > 0 || hasActiveFilters) && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-elev-1 rounded-full p-6 mb-4">
            <Search className="h-12 w-12 text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-fg mb-2">No sales match your filters</h3>
          <p className="text-sm text-muted mb-6 text-center max-w-sm">
            Try adjusting your search or clearing filters to see more results.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('')
              setSelectedPlatform('')
              setQuickFilter(null)
              updateParams({ search: undefined, platform: undefined })
              handleFilterChange()
            }}
            className="border-accent text-accent hover:bg-accent/10"
          >
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  )
}
