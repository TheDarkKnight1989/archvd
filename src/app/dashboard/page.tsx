'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { supabase } from '@/lib/supabase/client'
import { gbp0 } from '@/lib/utils/format'
import { Toast } from '@/components/ui/toast'
import { parseParams, buildQuery, type TableParams } from '@/lib/url/params'
import { Plus } from 'lucide-react'

// Matrix UI Components
import { KpiCard } from './components/KpiCard'
import { BreakdownCard } from './components/BreakdownCard'
import { PortfolioChart } from './components/PortfolioChart'
import { ItemsTable } from './components/ItemsTable'
import { ToolbarFilters } from './components/ToolbarFilters'
import { QuickAddModal } from './components/QuickAddModal'
import { BulkImportModal } from './components/BulkImportModal'

// Data Hooks
import {
  useKPIStats,
  useBrandBreakdown,
  useSizeBreakdown,
  useStatusBreakdown,
  usePortfolioChart,
  useItemsTable,
  useFilterOptions,
} from '@/hooks/useDashboardData'

export default function DashboardPage() {
  useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isOffline, setIsOffline] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [chartRange, setChartRange] = useState<number>(30) // days
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'default' | 'success' | 'error' | 'warning' } | null>(null)

  // Parse table params from URL
  const [tableParams, setTableParams] = useState<TableParams>(() => {
    if (typeof window === 'undefined') return {}
    return parseParams(new URLSearchParams(window.location.search))
  })

  // Sync URL params on mount and when searchParams change
  useEffect(() => {
    if (searchParams) {
      setTableParams(parseParams(new URLSearchParams(searchParams.toString())))
    }
  }, [searchParams])

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      setUserId(sessionData.session?.user?.id)
    }
    getUser()

    // Online/offline detection
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Real data hooks
  const kpiStats = useKPIStats(userId)
  const brandBreakdown = useBrandBreakdown(userId)
  const sizeBreakdown = useSizeBreakdown(userId)
  const statusBreakdown = useStatusBreakdown(userId)
  const portfolioChart = usePortfolioChart(userId, chartRange)
  const itemsTable = useItemsTable(userId, tableParams)
  const filterOptions = useFilterOptions(userId)

  // Handle table params change and update URL
  const handleParamsChange = (newParams: TableParams) => {
    setTableParams(newParams)
    const queryString = buildQuery(newParams)
    router.replace(`/dashboard${queryString}`, { scroll: false })
  }

  // Handle item added
  const handleItemAdded = () => {
    console.log('Item added successfully - refreshing data')
    // Refresh all data by reloading the page (hooks will refetch)
    window.location.reload()
  }

  // Handle CSV export
  const handleExport = () => {
    if (itemsTable.data.length === 0) {
      console.log('No data to export')
      return
    }

    // Generate CSV
    const headers = ['SKU', 'Title', 'Size', 'Status', 'Buy Price', 'Market Value', 'P/L', 'P/L %']
    const rows = itemsTable.data.map((row) => [
      row.sku,
      row.title,
      row.size,
      row.status,
      row.buy.toFixed(2),
      row.market ? row.market.toFixed(2) : 'N/A',
      row.pl ? row.pl.toFixed(2) : 'N/A',
      row.plPct ? row.plPct.toFixed(1) + '%' : 'N/A',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `archvd-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle bulk import success
  const handleBulkImportSuccess = (inserted: number, skipped: number, batchId: string) => {
    console.log(`Bulk import complete: ${inserted} inserted, ${skipped} skipped, batch: ${batchId}`)
    setToast({
      message: `Imported ${inserted} row${inserted !== 1 ? 's' : ''}${skipped > 0 ? ` • ${skipped} error${skipped !== 1 ? 's' : ''} skipped` : ''}`,
      variant: 'success',
    })
    // Reload page to refresh all data
    setTimeout(() => window.location.reload(), 2000)
  }

  // Handle pricing refresh
  const handleRefreshPricing = async () => {
    setIsRefreshing(true)
    setToast(null)

    try {
      const response = await fetch('/api/pricing/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (response.ok) {
        setToast({
          message: `Updated ${result.updated} of ${result.total} items • Portfolio: ${gbp0.format(result.portfolioValue || 0)}`,
          variant: 'success',
        })
        // Reload page to refresh all data
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setToast({
          message: result.error || 'Failed to refresh pricing',
          variant: 'error',
        })
      }
    } catch (error: any) {
      console.error('Pricing refresh error:', error)
      setToast({
        message: 'Failed to refresh pricing. Please try again.',
        variant: 'error',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-warning/20 border-b border-warning/30 px-4 py-2">
            <p className="text-sm text-warning text-center font-mono">
              Offline — showing cached values as of {new Date().toLocaleTimeString('en-GB')}
            </p>
          </div>
        )}

        {/* Header */}
        <header
          className="px-3 md:px-6 lg:px-8 py-4 md:py-5 border-b border-border bg-bg/60 backdrop-blur"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="mx-auto max-w-[1280px]">
            <h1 className="text-2xl font-bold text-fg relative inline-block">
              Dashboard
              <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
            </h1>
          </div>
        </header>

        {/* Content */}
        <section className="px-3 md:px-6 lg:px-8 py-4 md:py-6">
          <div className="mx-auto max-w-[1280px] space-y-4 md:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
              <KpiCard label="Total Items" value={kpiStats.data.totalItems} loading={kpiStats.loading} />
              <KpiCard label="In Stock" value={kpiStats.data.inStock} loading={kpiStats.loading} />
              <KpiCard label="Sold" value={kpiStats.data.sold} loading={kpiStats.loading} />
              <KpiCard
                label="Inventory Value"
                value={gbp0.format(kpiStats.data.totalValue)}
                loading={kpiStats.loading}
              />
            </div>

            {/* Portfolio Chart */}
            <PortfolioChart
              series={portfolioChart.data}
              loading={portfolioChart.loading}
              onRangeChange={setChartRange}
              currentRange={chartRange}
            />

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <BreakdownCard title="By Status" items={statusBreakdown.data} loading={statusBreakdown.loading} />
              <BreakdownCard title="By Brand" items={brandBreakdown.data} loading={brandBreakdown.loading} />
              <BreakdownCard title="By Size" items={sizeBreakdown.data} loading={sizeBreakdown.loading} />
            </div>

            {/* Toolbar */}
            <ToolbarFilters
              onQuickAdd={() => setQuickAddOpen(true)}
              onExport={handleExport}
              onRefreshPricing={handleRefreshPricing}
              isRefreshing={isRefreshing}
              onBulkImport={() => setBulkImportOpen(true)}
              params={tableParams}
              onParamsChange={handleParamsChange}
              brands={filterOptions.brands}
              sizes={filterOptions.sizes}
            />

            {/* Items Table */}
            <ItemsTable rows={itemsTable.data} loading={itemsTable.loading} />
          </div>
        </section>

      {/* Quick Add FAB (Mobile only - replaces MobileDock FAB for dashboard) */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-accent text-black shadow-glow flex items-center justify-center hover:bg-accent-600 transition-colors duration-fast md:hidden active:scale-95"
        style={{ bottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
        aria-label="Quick Add"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Quick Add Modal */}
      <QuickAddModal
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onSuccess={handleItemAdded}
        userId={userId}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={handleBulkImportSuccess}
        userId={userId}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
