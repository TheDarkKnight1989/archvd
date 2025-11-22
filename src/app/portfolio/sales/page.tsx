'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSalesTable, exportSalesToCSV, type SalesItem } from '@/hooks/useSalesTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download, TrendingUp, Calendar, Filter, X, RefreshCw, Link2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { SalesTable } from './_components/SalesTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SortingState } from '@tanstack/react-table'

export default function SalesPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { convert, format } = useCurrency()

  // State
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '')
  const [selectedPlatform, setSelectedPlatform] = useState<string>(searchParams.get('platform') || '')
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('date_from') || '')
  const [dateTo, setDateTo] = useState<string>(searchParams.get('date_to') || '')
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false)

  // Platform options
  const PLATFORMS = [
    { value: 'stockx', label: 'StockX' },
    { value: 'alias', label: 'Alias' },
    { value: 'ebay', label: 'eBay' },
    { value: 'private', label: 'Private Sale' },
    { value: 'other', label: 'Other' },
  ]

  // Date range presets
  const setDatePreset = (preset: 'all' | '30d' | '90d' | 'ytd') => {
    const today = new Date()
    let from = ''

    if (preset === '30d') {
      from = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0]
    } else if (preset === '90d') {
      from = new Date(today.setDate(today.getDate() - 90)).toISOString().split('T')[0]
    } else if (preset === 'ytd') {
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
    }

    setDateFrom(from)
    setDateTo('')
    updateParams({ date_from: from || undefined, date_to: undefined })
  }

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sold_date', desc: true }, // Default: most recent first
  ])

  // Fetch sales data
  const { items, loading, error: fetchError, refetch } = useSalesTable({
    search: searchQuery || undefined,
    platform: selectedPlatform || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    sort_by: (sorting[0]?.id as any) || 'sold_date',
    sort_order: sorting[0]?.desc ? 'desc' : 'asc',
  })

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

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalSales = items.reduce((sum, item) => sum + (item.sold_price || 0), 0)
    const totalCOGS = items.reduce((sum, item) =>
      sum + (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0) + (item.commission || 0), 0
    )
    const totalMargin = items.reduce((sum, item) => sum + (item.margin_gbp || 0), 0)
    const avgMargin = items.length > 0
      ? items.reduce((sum, item) => sum + (item.margin_percent || 0), 0) / items.length
      : 0
    const avgSalePrice = items.length > 0 ? totalSales / items.length : 0

    return {
      totalSales,
      totalCOGS,
      totalMargin,
      avgMargin,
      avgSalePrice,
      count: items.length,
    }
  }, [items])

  // Export CSV
  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0]
    exportSalesToCSV(items, `archvd-sales-${date}.csv`)
  }

  // Refresh data
  const handleRefresh = () => {
    refetch()
    setLastRefreshed(new Date())
  }

  // Copy current URL to clipboard
  const handleCopyLink = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    setCopyLinkSuccess(true)
    setTimeout(() => setCopyLinkSuccess(false), 2000)
  }

  // Get time ago string
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  // Active filter count
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (selectedPlatform ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0)

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Sales
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent opacity-40"></span>
        </h1>
      </div>

      {/* KPI Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Total Sales</div>
            <div className="text-2xl font-bold text-fg font-mono">
              {format(convert(kpis.totalSales, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">{kpis.count} items</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Avg Sale Price</div>
            <div className="text-2xl font-bold text-fg font-mono">
              {format(convert(kpis.avgSalePrice, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Per item</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">COGS</div>
            <div className="text-2xl font-bold text-fg font-mono">
              {format(convert(kpis.totalCOGS, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Cost of goods sold</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Gross Profit</div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              kpis.totalMargin >= 0 ? "money-pos" : "money-neg"
            )}>
              {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Total margin</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Avg Margin</div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              kpis.avgMargin >= 0 ? "money-pos" : "money-neg"
            )}>
              {kpis.avgMargin >= 0 ? '+' : ''}{kpis.avgMargin.toFixed(1)}%
            </div>
            <div className="text-xs text-muted mt-1.5">Average profit %</div>
          </div>
        </div>
      )}

      {/* Toolbar - Sticky */}
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-3 bg-bg/90 backdrop-blur border-b border-border/40">
        <div className="flex flex-col gap-3">
          {/* Row 0: Quick Stats + Actions */}
          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-muted">
                <span className="font-medium">{kpis.count} sales</span>
                <span className="text-border">•</span>
                <span>{format(convert(kpis.totalSales, 'GBP'))} revenue</span>
                <span className="text-border">•</span>
                <span className={kpis.avgMargin >= 0 ? 'money-pos' : 'money-neg'}>
                  {kpis.avgMargin >= 0 ? '+' : ''}{kpis.avgMargin.toFixed(1)}% avg margin
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-elev-1 transition-colors text-muted hover:text-fg"
                  title="Refresh data"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{getTimeAgo(lastRefreshed)}</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
                    copyLinkSuccess
                      ? "bg-accent/20 text-accent"
                      : "hover:bg-elev-1 text-muted hover:text-fg"
                  )}
                  title="Copy link to this view"
                >
                  {copyLinkSuccess ? (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Row 1: Search + Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
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
                  'pl-9 pr-8 bg-elev-0 border-border transition-all duration-120 text-fg',
                  searchQuery && 'ring-2 ring-accent/40'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    updateParams({ search: undefined })
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-elev-1 text-muted hover:text-fg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Platform Filter */}
              <Select
                value={selectedPlatform}
                onValueChange={(value) => {
                  setSelectedPlatform(value)
                  updateParams({ platform: value || undefined })
                }}
              >
                <SelectTrigger className={cn(
                  "w-40 bg-elev-0 border-border text-fg text-sm",
                  selectedPlatform && 'ring-2 ring-accent/40'
                )}>
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted" />
                    <SelectValue placeholder="Platform" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date From */}
              <div className="relative">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    updateParams({ date_from: e.target.value || undefined })
                  }}
                  className={cn(
                    "w-40 bg-elev-0 border-border text-fg text-sm",
                    dateFrom && 'ring-2 ring-accent/40 pr-8'
                  )}
                  placeholder="From date"
                />
                {dateFrom && (
                  <button
                    onClick={() => {
                      setDateFrom('')
                      updateParams({ date_from: undefined })
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-elev-1 text-muted hover:text-fg transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Date To */}
              <div className="relative">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    updateParams({ date_to: e.target.value || undefined })
                  }}
                  className={cn(
                    "w-40 bg-elev-0 border-border text-fg text-sm",
                    dateTo && 'ring-2 ring-accent/40 pr-8'
                  )}
                  placeholder="To date"
                />
                {dateTo && (
                  <button
                    onClick={() => {
                      setDateTo('')
                      updateParams({ date_to: undefined })
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-elev-1 text-muted hover:text-fg transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 1.5: Date Presets */}
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted" />
            <span className="text-muted">Quick:</span>
            <button
              onClick={() => setDatePreset('30d')}
              className={cn(
                "px-2 py-1 rounded hover:bg-elev-1 transition-colors",
                !dateFrom && !dateTo ? "text-muted" : "text-accent"
              )}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setDatePreset('90d')}
              className="px-2 py-1 rounded hover:bg-elev-1 transition-colors text-muted hover:text-fg"
            >
              Last 90 days
            </button>
            <button
              onClick={() => setDatePreset('ytd')}
              className="px-2 py-1 rounded hover:bg-elev-1 transition-colors text-muted hover:text-fg"
            >
              Year to date
            </button>
            <button
              onClick={() => setDatePreset('all')}
              className="px-2 py-1 rounded hover:bg-elev-1 transition-colors text-muted hover:text-fg"
            >
              All time
            </button>
          </div>

          {/* Row 2: Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              {loading && <span>Loading...</span>}
              {!loading && items.length > 0 && (
                <span>{items.length} {items.length === 1 ? 'sale' : 'sales'}</span>
              )}
              {activeFilterCount > 0 && (
                <>
                  <span className="text-border">•</span>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedPlatform('')
                      setDateFrom('')
                      setDateTo('')
                      updateParams({ search: undefined, platform: undefined, date_from: undefined, date_to: undefined })
                    }}
                    className="text-accent hover:underline"
                  >
                    Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={handleExportCSV}
                disabled={items.length === 0}
                size="sm"
                className="max-md:hidden"
              >
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
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

      {/* Sales Table */}
      <SalesTable
        items={items}
        loading={loading}
        sorting={sorting}
        onSortingChange={setSorting}
      />

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-elev-1 rounded-full p-6 mb-4">
            <TrendingUp className="h-12 w-12 text-muted" />
          </div>
          {activeFilterCount > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-fg mb-2">No sales found</h3>
              <p className="text-sm text-muted mb-4 text-center max-w-sm">
                No sales match your current filters. Try adjusting your search criteria.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedPlatform('')
                  setDateFrom('')
                  setDateTo('')
                  updateParams({ search: undefined, platform: undefined, date_from: undefined, date_to: undefined })
                }}
                className="border-accent text-accent hover:bg-accent/10"
              >
                Clear All Filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-fg mb-2">No sales yet</h3>
              <p className="text-sm text-muted mb-4 text-center max-w-sm">
                When you mark items as sold in your portfolio, they'll appear here with profit tracking.
              </p>
              <Button
                variant="outline"
                onClick={() => router.push('/portfolio/inventory')}
                className="border-accent text-accent hover:bg-accent/10"
              >
                Go to Portfolio
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
