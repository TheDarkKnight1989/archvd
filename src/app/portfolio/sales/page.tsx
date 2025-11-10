'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useSalesTable, exportSalesToCSV, type SalesItem } from '@/hooks/useSalesTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { SalesTable } from './_components/SalesTable'
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
      sum + (item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0) + (item.sold_fees || 0), 0
    )
    const totalMargin = items.reduce((sum, item) => sum + (item.margin_gbp || 0), 0)
    const avgMargin = items.length > 0
      ? items.reduce((sum, item) => sum + (item.margin_percent || 0), 0) / items.length
      : 0

    return {
      totalSales,
      totalCOGS,
      totalMargin,
      avgMargin,
      count: items.length,
    }
  }, [items])

  // Export CSV
  const handleExportCSV = () => {
    const date = new Date().toISOString().split('T')[0]
    exportSalesToCSV(items, `archvd-sales-${date}.csv`)
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Sales</div>
            <div className="text-2xl font-bold text-fg font-mono">
              {format(convert(kpis.totalSales, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">{kpis.count} items</div>
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
              kpis.totalMargin >= 0 ? "text-success" : "text-danger"
            )}>
              {kpis.totalMargin >= 0 ? '+' : ''}{format(convert(kpis.totalMargin, 'GBP'))}
            </div>
            <div className="text-xs text-muted mt-1.5">Total margin</div>
          </div>

          <div className="bg-elev-1 border border-border/40 rounded-lg p-4 transition-colors hover:border-border">
            <div className="text-xs text-dim uppercase tracking-wider mb-1.5">Avg Margin</div>
            <div className={cn(
              "text-2xl font-bold font-mono",
              kpis.avgMargin >= 0 ? "text-success" : "text-danger"
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
                  'pl-9 bg-elev-0 border-border transition-all duration-120 text-fg',
                  searchQuery && 'ring-2 ring-accent/40'
                )}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Date From */}
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  updateParams({ date_from: e.target.value || undefined })
                }}
                className="w-40 bg-elev-0 border-border text-fg text-sm"
                placeholder="From date"
              />

              {/* Date To */}
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  updateParams({ date_to: e.target.value || undefined })
                }}
                className="w-40 bg-elev-0 border-border text-fg text-sm"
                placeholder="To date"
              />
            </div>
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
        </div>
      )}
    </div>
  )
}
