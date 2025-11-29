'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSalesTable, exportSalesToCSV, type SalesItem } from '@/hooks/useSalesTable'
import { useTablePreferences } from '@/hooks/useTablePreferences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, Download, TrendingUp, Calendar, ChevronDown,
  FileText, Receipt, Clock, RefreshCw, Bookmark, Filter,
  BarChart3, DollarSign, Info
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { SalesTable } from './_components/SalesTable'
import { ColumnVisibilityDropdown } from '@/components/table/ColumnVisibilityDropdown'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { RevenueChart } from './_components/RevenueChart'
import { PerformanceMetrics } from './_components/PerformanceMetrics'
import { TaxYearSummary } from './_components/TaxYearSummary'
import { BulkActionsToolbar } from './_components/BulkActionsToolbar'
import { DataQualityChecks } from './_components/DataQualityChecks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileStatsOpen, setMobileStatsOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showAnalytics, setShowAnalytics] = useState(true)

  // Table preferences for column visibility
  const {
    preferences: tablePrefs,
    toggleColumnVisibility,
    resetPreferences,
  } = useTablePreferences('sales-table', [
    'item',
    'purchase_price',
    'sold_price',
    'commission',
    'net_payout',
    'margin_gbp',
    'margin_percent',
    'sold_date',
    'platform',
  ])

  // Column configurations for visibility dropdown
  const columnConfigs = [
    { id: 'item', label: 'Item', visible: tablePrefs.columns.item?.visible ?? true, required: true },
    { id: 'purchase_price', label: 'Buy Price', visible: tablePrefs.columns.purchase_price?.visible ?? true },
    { id: 'sold_price', label: 'Sale Price', visible: tablePrefs.columns.sold_price?.visible ?? true },
    { id: 'commission', label: 'Fees', visible: tablePrefs.columns.commission?.visible ?? true },
    { id: 'net_payout', label: 'Net Payout', visible: tablePrefs.columns.net_payout?.visible ?? true },
    { id: 'margin_gbp', label: 'Profit', visible: tablePrefs.columns.margin_gbp?.visible ?? true },
    { id: 'margin_percent', label: 'Margin %', visible: tablePrefs.columns.margin_percent?.visible ?? true },
    { id: 'sold_date', label: 'Sold Date', visible: tablePrefs.columns.sold_date?.visible ?? true },
    { id: 'platform', label: 'Platform', visible: tablePrefs.columns.platform?.visible ?? true },
  ]

  // Platform filter tabs
  const platformTabs = [
    { key: '', label: '📦 All', emoji: '📦' },
    { key: 'stockx', label: '🟢 StockX', emoji: '🟢' },
    { key: 'alias', label: '🟣 Alias', emoji: '🟣' },
    { key: 'ebay', label: '🔴 eBay', emoji: '🔴' },
    { key: 'private', label: '👤 Private', emoji: '👤' },
    { key: 'other', label: '⚪ Other', emoji: '⚪' },
  ]

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sold_date', desc: true },
  ])

  // Fetch sales data with filters
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

  // Quick filter presets
  const applyQuickFilter = (filterKey: string) => {
    const now = new Date()
    const currentYear = now.getFullYear()

    if (filterKey === quickFilter) {
      // Toggle off
      setQuickFilter(null)
      setDateFrom('')
      setDateTo('')
      updateParams({ date_from: undefined, date_to: undefined })
      return
    }

    setQuickFilter(filterKey)

    switch (filterKey) {
      case 'this-month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        setDateFrom(monthStart.toISOString().split('T')[0])
        setDateTo('')
        updateParams({
          date_from: monthStart.toISOString().split('T')[0],
          date_to: undefined
        })
        break
      case 'last-month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        setDateFrom(lastMonthStart.toISOString().split('T')[0])
        setDateTo(lastMonthEnd.toISOString().split('T')[0])
        updateParams({
          date_from: lastMonthStart.toISOString().split('T')[0],
          date_to: lastMonthEnd.toISOString().split('T')[0]
        })
        break
      case 'q1':
        // Q1: Jan 1 - Mar 31
        const q1Start = new Date(currentYear, 0, 1)
        const q1End = new Date(currentYear, 2, 31)
        setDateFrom(q1Start.toISOString().split('T')[0])
        setDateTo(q1End.toISOString().split('T')[0])
        updateParams({
          date_from: q1Start.toISOString().split('T')[0],
          date_to: q1End.toISOString().split('T')[0]
        })
        break
      case 'q2':
        // Q2: Apr 1 - Jun 30
        const q2Start = new Date(currentYear, 3, 1)
        const q2End = new Date(currentYear, 5, 30)
        setDateFrom(q2Start.toISOString().split('T')[0])
        setDateTo(q2End.toISOString().split('T')[0])
        updateParams({
          date_from: q2Start.toISOString().split('T')[0],
          date_to: q2End.toISOString().split('T')[0]
        })
        break
      case 'q3':
        // Q3: Jul 1 - Sep 30
        const q3Start = new Date(currentYear, 6, 1)
        const q3End = new Date(currentYear, 8, 30)
        setDateFrom(q3Start.toISOString().split('T')[0])
        setDateTo(q3End.toISOString().split('T')[0])
        updateParams({
          date_from: q3Start.toISOString().split('T')[0],
          date_to: q3End.toISOString().split('T')[0]
        })
        break
      case 'q4':
        // Q4: Oct 1 - Dec 31
        const q4Start = new Date(currentYear, 9, 1)
        const q4End = new Date(currentYear, 11, 31)
        setDateFrom(q4Start.toISOString().split('T')[0])
        setDateTo(q4End.toISOString().split('T')[0])
        updateParams({
          date_from: q4Start.toISOString().split('T')[0],
          date_to: q4End.toISOString().split('T')[0]
        })
        break
      case 'ytd':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        setDateFrom(yearStart.toISOString().split('T')[0])
        setDateTo('')
        updateParams({
          date_from: yearStart.toISOString().split('T')[0],
          date_to: undefined
        })
        break
      case 'last-90':
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(now.getDate() - 90)
        setDateFrom(ninetyDaysAgo.toISOString().split('T')[0])
        setDateTo('')
        updateParams({
          date_from: ninetyDaysAgo.toISOString().split('T')[0],
          date_to: undefined
        })
        break
    }
  }

  // Apply filtered items based on quick filters
  const filteredItems = useMemo(() => {
    let filtered = items

    // Additional client-side quick filters
    if (quickFilter === 'profitable') {
      filtered = filtered.filter(item => (item.margin_gbp || 0) > 0)
    } else if (quickFilter === 'loss-making') {
      filtered = filtered.filter(item => (item.margin_gbp || 0) < 0)
    } else if (quickFilter === 'high-value') {
      filtered = filtered.filter(item => (item.sold_price || 0) >= 200)
    }

    return filtered
  }, [items, quickFilter])

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalSales = filteredItems.reduce((sum, item) => sum + (item.sold_price || 0), 0)
    const totalCOGS = filteredItems.reduce((sum, item) =>
      sum + (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0), 0
    )
    const totalFees = filteredItems.reduce((sum, item) => sum + (item.sales_fee || 0), 0)
    const totalMargin = filteredItems.reduce((sum, item) => sum + (item.margin_gbp || 0), 0)
    const avgMargin = filteredItems.length > 0
      ? filteredItems.reduce((sum, item) => sum + (item.margin_percent || 0), 0) / filteredItems.length
      : 0

    return {
      totalSales,
      totalCOGS,
      totalFees,
      totalMargin,
      avgMargin,
      count: filteredItems.length,
    }
  }, [filteredItems])

  // Export CSV
  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0]
    exportSalesToCSV(filteredItems, `archvd-sales-${date}.csv`)
  }

  // Bulk actions
  const selectedItemsArray = useMemo(() => {
    return filteredItems.filter(item => selectedItems.has(item.id))
  }, [filteredItems, selectedItems])

  const handleBulkExport = () => {
    const date = new Date().toISOString().split('T')[0]
    exportSalesToCSV(selectedItemsArray, `archvd-sales-selected-${date}.csv`)
  }

  const handleClearSelection = () => {
    setSelectedItems(new Set())
  }

  // Active filter count
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (selectedPlatform ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0)

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-[#00FF94]/10 shadow-lg">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-semibold text-fg tracking-tight mb-2">
            Sales
          </h1>
          <p className="text-sm text-fg/70 max-w-2xl">
            Track sold items and analyze your sales performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="default"
                className="transition-boutique shadow-soft border-border hover:border-[#00FF94]/60"
                disabled={filteredItems.length === 0}
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
                onClick={handleExportCSV}
                disabled={filteredItems.length === 0}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 mr-2" />
                Sales Report
                <span className="ml-auto text-xs text-[#7FA08F]">CSV</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />
              <DropdownMenuItem
                onClick={handleExportCSV}
                disabled={filteredItems.length === 0}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Tax Report
                <span className="ml-auto text-xs text-[#7FA08F]">CSV</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            variant="outline"
            size="default"
            onClick={() => refetch()}
            className="transition-boutique shadow-soft border-border hover:border-[#00FF94]/60 hidden md:flex"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Column Visibility (Desktop) */}
          <div className="hidden md:block">
            <ColumnVisibilityDropdown
              columns={columnConfigs}
              onToggle={toggleColumnVisibility}
              onReset={resetPreferences}
            />
          </div>

          {/* Mobile Filter Button */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden transition-boutique shadow-soft border-border hover:border-[#00FF94]/60"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Quick Stats Widget */}
      <div className="md:hidden sticky top-0 z-40">
        <button
          onClick={() => setMobileStatsOpen(!mobileStatsOpen)}
          className="w-full bg-gradient-to-r from-elev-1 to-elev-1/90 border border-border/40 rounded-xl p-3 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#00FF94]" />
            <span className="font-semibold text-fg">Quick Stats</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-dim">Sales</div>
              <div className="text-sm font-bold text-[#00FF94] mono">{kpis.count}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-dim">Profit</div>
              <div className={cn(
                "text-sm font-bold mono",
                kpis.totalMargin >= 0 ? "text-[#00FF94]" : "text-red-400"
              )}>
                {format(convert(kpis.totalMargin, 'GBP'))}
              </div>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted transition-transform",
              mobileStatsOpen && "rotate-180"
            )} />
          </div>
        </button>

        {mobileStatsOpen && (
          <div className="bg-elev-1 border-x border-b border-border/40 rounded-b-xl p-3 space-y-2 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-elev-2 rounded-lg p-2.5">
                <div className="text-xs text-dim mb-1">Total Sales</div>
                <div className="text-lg font-bold text-fg mono">
                  {format(convert(kpis.totalSales, 'GBP'))}
                </div>
              </div>
              <div className="bg-elev-2 rounded-lg p-2.5">
                <div className="text-xs text-dim mb-1">COGS</div>
                <div className="text-lg font-bold text-fg mono">
                  {format(convert(kpis.totalCOGS, 'GBP'))}
                </div>
              </div>
              <div className="bg-elev-2 rounded-lg p-2.5">
                <div className="text-xs text-dim mb-1">Fees</div>
                <div className="text-lg font-bold text-fg mono">
                  {format(convert(kpis.totalFees, 'GBP'))}
                </div>
              </div>
              <div className="bg-elev-2 rounded-lg p-2.5">
                <div className="text-xs text-dim mb-1">Avg Margin</div>
                <div className={cn(
                  "text-lg font-bold mono",
                  kpis.avgMargin >= 0 ? "text-[#00FF94]" : "text-red-400"
                )}>
                  {kpis.avgMargin >= 0 ? '+' : ''}{kpis.avgMargin.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="bg-elev-1 border border-border/40 rounded-xl p-4 transition-all hover:border-[#00FF94]/30 hover:shadow-lg">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5 font-semibold">Total Sales</div>
            <div className="text-2xl font-bold text-fg mono">
              {format(convert(kpis.totalSales, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">{kpis.count} items</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-xl p-4 transition-all hover:border-[#00FF94]/30 hover:shadow-lg">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5 font-semibold">COGS</div>
            <div className="text-2xl font-bold text-fg mono">
              {format(convert(kpis.totalCOGS, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Cost of goods</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-xl p-4 transition-all hover:border-[#00FF94]/30 hover:shadow-lg">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5 font-semibold">Fees</div>
            <div className="text-2xl font-bold text-fg mono">
              {format(convert(kpis.totalFees, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Total fees paid</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-xl p-4 transition-all hover:border-[#00FF94]/30 hover:shadow-lg">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5 font-semibold">Profit</div>
            <div className={cn(
              "text-2xl font-bold mono",
              kpis.totalMargin >= 0 ? "text-[#00FF94]" : "text-red-400"
            )}>
              {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Gross profit</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-xl p-4 transition-all hover:border-[#00FF94]/30 hover:shadow-lg">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5 font-semibold">Avg Margin</div>
            <div className={cn(
              "text-2xl font-bold mono",
              kpis.avgMargin >= 0 ? "text-[#00FF94]" : "text-red-400"
            )}>
              {kpis.avgMargin >= 0 ? '+' : ''}{kpis.avgMargin.toFixed(1)}%
            </div>
            <div className="text-xs text-muted mt-1.5">Average margin</div>
          </div>
        </div>
      )}

      {/* Analytics Dashboard */}
      {filteredItems.length > 0 && showAnalytics && (
        <div className="space-y-6">
          {/* Revenue Chart and Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <RevenueChart items={filteredItems} />
            </div>
            <div className="lg:col-span-1">
              <div className="bg-elev-1 border border-border/40 rounded-xl p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnalytics(false)}
                  className="float-right text-xs text-muted hover:text-fg"
                >
                  Hide Analytics
                </Button>
                <h3 className="text-sm font-semibold text-fg uppercase tracking-wide mb-3">Quick Stats</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-dim mb-1">ROI</div>
                    <div className="text-2xl font-bold text-[#00FF94] mono">
                      {kpis.totalCOGS > 0 ? `+${((kpis.totalMargin / kpis.totalCOGS) * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-dim mb-1">Avg Sale</div>
                    <div className="text-2xl font-bold text-fg mono">
                      {kpis.count > 0 ? format(convert(kpis.totalSales / kpis.count, 'GBP')) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <PerformanceMetrics items={filteredItems} />

          {/* Tax Year Summary */}
          <TaxYearSummary items={filteredItems} />

          {/* Data Quality Checks */}
          <DataQualityChecks items={filteredItems} />
        </div>
      )}

      {!showAnalytics && filteredItems.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAnalytics(true)}
          className="border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Show Analytics Dashboard
        </Button>
      )}

      {/* Filter Bar - Sticky */}
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-4 bg-bg/95 backdrop-blur-lg border-y border-border/40">
        <div className="flex flex-col gap-5">
          {/* Search + Platform Filter Row */}
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

            {/* Platform Filter Tabs */}
            <div className="flex items-center gap-1.5">
              {platformTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={selectedPlatform === tab.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedPlatform(tab.key)
                    updateParams({ platform: tab.key || undefined })
                  }}
                  className={cn(
                    'h-8 text-xs font-semibold transition-all duration-200',
                    selectedPlatform === tab.key
                      ? 'bg-[#00FF94] text-black hover:bg-[#00E085] shadow-lg'
                      : 'border-border/50 text-fg/80 hover:bg-elev-1 hover:border-border'
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#00FF94]/85 uppercase tracking-wide mr-0.5">
              <Calendar className="h-3.5 w-3.5 inline mr-1" />
              Quick Filters:
            </span>
            <Button
              variant={quickFilter === 'this-month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('this-month')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'this-month'
                  ? 'bg-[#00FF94] text-black hover:bg-[#00E085] shadow-lg'
                  : 'border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10 hover:border-[#00FF94]/50'
              )}
            >
              This Month
            </Button>
            <Button
              variant={quickFilter === 'last-month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('last-month')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'last-month'
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
                  : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50'
              )}
            >
              Last Month
            </Button>
            <Button
              variant={quickFilter === 'ytd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('ytd')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'ytd'
                  ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg'
                  : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50'
              )}
            >
              Year to Date
            </Button>
            <Button
              variant={quickFilter === 'last-90' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('last-90')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'last-90'
                  ? 'bg-amber-500 text-black hover:bg-amber-600 shadow-lg'
                  : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50'
              )}
            >
              Last 90 Days
            </Button>

            {/* Divider */}
            <div className="h-5 w-px bg-border/40 mx-1" />

            <Button
              variant={quickFilter === 'profitable' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('profitable')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'profitable'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg'
                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50'
              )}
            >
              💰 Profitable
            </Button>
            <Button
              variant={quickFilter === 'loss-making' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('loss-making')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'loss-making'
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
                  : 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50'
              )}
            >
              📉 Loss Making
            </Button>
            <Button
              variant={quickFilter === 'high-value' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('high-value')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'high-value'
                  ? 'bg-yellow-500 text-black hover:bg-yellow-600 shadow-lg'
                  : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/50'
              )}
            >
              💎 High Value (£200+)
            </Button>

            {/* Divider */}
            <div className="h-5 w-px bg-border/40 mx-1" />

            {/* Quarterly Filters */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="h-7 w-7 rounded-md flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 transition-all">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-[#0E1A15] border-[#15251B] p-3">
                  <div className="text-xs space-y-2">
                    <div className="font-semibold text-[#00FF94] mb-2">Calendar Year Quarters</div>
                    <div className="space-y-1 text-[#E8F6EE]">
                      <div><span className="font-bold text-cyan-400">Q1:</span> Jan 1 - Mar 31</div>
                      <div><span className="font-bold text-cyan-400">Q2:</span> Apr 1 - Jun 30</div>
                      <div><span className="font-bold text-cyan-400">Q3:</span> Jul 1 - Sep 30</div>
                      <div><span className="font-bold text-cyan-400">Q4:</span> Oct 1 - Dec 31</div>
                    </div>
                    <div className="text-[#7FA08F] mt-2 pt-2 border-t border-[#15251B]">
                      Tax year quarters may differ. See Tax Summary below.
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant={quickFilter === 'q1' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('q1')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'q1'
                  ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg'
                  : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50'
              )}
            >
              Q1
            </Button>
            <Button
              variant={quickFilter === 'q2' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('q2')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'q2'
                  ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg'
                  : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50'
              )}
            >
              Q2
            </Button>
            <Button
              variant={quickFilter === 'q3' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('q3')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'q3'
                  ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg'
                  : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50'
              )}
            >
              Q3
            </Button>
            <Button
              variant={quickFilter === 'q4' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyQuickFilter('q4')}
              className={cn(
                'h-7 text-xs font-semibold transition-all duration-200',
                quickFilter === 'q4'
                  ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg'
                  : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50'
              )}
            >
              Q4
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
                    setSelectedPlatform('')
                    setDateFrom('')
                    setDateTo('')
                    setQuickFilter(null)
                    updateParams({ status: undefined, search: undefined, platform: undefined, date_from: undefined, date_to: undefined })
                  }}
                  className="text-xs text-muted hover:text-fg"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>{filteredItems.length} sales</span>
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
        items={filteredItems}
        loading={loading}
        sorting={sorting}
        onSortingChange={setSorting}
        onRefresh={refetch}
      />

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-elev-1 rounded-full p-6 mb-4">
            <TrendingUp className="h-12 w-12 text-muted" />
          </div>
          {activeFilterCount > 0 || quickFilter ? (
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
                  setQuickFilter(null)
                  updateParams({ search: undefined, platform: undefined, date_from: undefined, date_to: undefined })
                }}
                className="border-[#00FF94] text-[#00FF94] hover:bg-[#00FF94]/10"
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
                className="border-[#00FF94] text-[#00FF94] hover:bg-[#00FF94]/10"
              >
                Go to Portfolio
              </Button>
            </>
          )}
        </div>
      )}

      {/* Mobile Filters Bottom Sheet */}
      <BottomSheet
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        title="Filters & Options"
      >
        <div className="p-4 space-y-6">
          {/* Search */}
          <div>
            <label className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="Search SKU, brand, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Platform Filters */}
          <div>
            <label className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 block">
              Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platformTabs.map((tab) => (
                <Button
                  key={tab.key}
                  variant={selectedPlatform === tab.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedPlatform(tab.key)
                    updateParams({ platform: tab.key || undefined })
                  }}
                  className={cn(
                    'h-10 text-sm font-semibold',
                    selectedPlatform === tab.key
                      ? 'bg-[#00FF94] text-black'
                      : 'border-border/50'
                  )}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div>
            <label className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 block">
              Quick Filters
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={quickFilter === 'this-month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('this-month')}
                className={cn(
                  'h-10',
                  quickFilter === 'this-month'
                    ? 'bg-[#00FF94] text-black'
                    : 'border-border/50'
                )}
              >
                This Month
              </Button>
              <Button
                variant={quickFilter === 'last-month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('last-month')}
                className={cn(
                  'h-10',
                  quickFilter === 'last-month'
                    ? 'bg-blue-500 text-white'
                    : 'border-border/50'
                )}
              >
                Last Month
              </Button>
              <Button
                variant={quickFilter === 'ytd' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('ytd')}
                className={cn(
                  'h-10',
                  quickFilter === 'ytd'
                    ? 'bg-purple-500 text-white'
                    : 'border-border/50'
                )}
              >
                Year to Date
              </Button>
              <Button
                variant={quickFilter === 'profitable' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('profitable')}
                className={cn(
                  'h-10',
                  quickFilter === 'profitable'
                    ? 'bg-emerald-500 text-white'
                    : 'border-border/50'
                )}
              >
                💰 Profitable
              </Button>
            </div>
          </div>

          {/* Column Visibility */}
          <div>
            <label className="text-xs font-semibold text-dim uppercase tracking-wide mb-2 block">
              Show/Hide Columns
            </label>
            <div className="space-y-2">
              {columnConfigs.filter(col => !col.required).map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-elev-2 border border-border/40"
                >
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnVisibility(col.id)}
                    className="w-4 h-4 rounded border-border text-[#00FF94] focus:ring-[#00FF94]/30"
                  />
                  <span className="text-sm text-fg">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedPlatform('')
                setDateFrom('')
                setDateTo('')
                setQuickFilter(null)
                updateParams({ search: undefined, platform: undefined, date_from: undefined, date_to: undefined })
              }}
              className="flex-1"
            >
              Clear Filters
            </Button>
            <Button
              onClick={() => setMobileFiltersOpen(false)}
              className="flex-1 bg-[#00FF94] text-black hover:bg-[#00E085]"
            >
              Apply
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedItems.size}
        selectedItems={selectedItemsArray}
        onClearSelection={handleClearSelection}
        onBulkExport={handleBulkExport}
      />
    </div>
  )
}
