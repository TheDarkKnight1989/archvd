'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download, TrendingUp, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { TransactionsTable } from './_components/TransactionsTable'
import { KpiCards } from './_components/KpiCards'
import { useTransactions } from '@/hooks/useTransactions'
import { EditTransactionModal } from './_components/EditTransactionModal'
import type { TxRow } from '@/lib/transactions/types'

type TabType = 'sales' | 'purchases'
type TimeRangeType = 'all' | '7d' | '30d' | '90d'

export default function TransactionsHistoryPage() {
  const { user } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { convert, format } = useCurrency()

  // State
  const tab = (searchParams.get('tab') as TabType) || 'sales'
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '')
  const [timeRange, setTimeRange] = useState<TimeRangeType>(
    (searchParams.get('timeRange') as TimeRangeType) || 'all'
  )
  const [editingTransaction, setEditingTransaction] = useState<TxRow | null>(null)

  // Fetch transactions data
  const { data, loading, error, refetch } = useTransactions({
    type: tab,
    q: searchQuery,
    timeRange,
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
    router.replace(`/portfolio/transactions/history${query ? `?${query}` : ''}`)
  }

  const handleTabChange = (newTab: TabType) => {
    updateParams({ tab: newTab })
  }

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        type: tab,
        ...(searchQuery && { q: searchQuery }),
        ...(timeRange && { timeRange }),
      })

      const response = await fetch(`/api/transactions/export?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${tab}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    }
  }

  // Active filter count
  const activeFilterCount = (searchQuery ? 1 : 0) + (timeRange !== 'all' ? 1 : 0)

  return (
    <div className="mx-auto max-w-[1600px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Transactions
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent opacity-40"></span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-elev-1 border border-border rounded-xl p-1">
        <button
          onClick={() => handleTabChange('sales')}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'sales'
              ? 'bg-accent/20 text-fg border border-accent/40'
              : 'text-dim hover:text-fg hover:bg-elev-2'
          )}
        >
          Sales
        </button>
        <button
          onClick={() => handleTabChange('purchases')}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'purchases'
              ? 'bg-accent/20 text-fg border border-accent/40'
              : 'text-dim hover:text-fg hover:bg-elev-2'
          )}
        >
          Purchases
        </button>
      </div>

      {/* KPI Cards */}
      {data && <KpiCards kpis={data.kpis} type={tab} />}

      {/* Toolbar - Sticky */}
      <div className="sticky top-0 z-30 -mx-3 md:-mx-6 lg:-mx-8 px-3 md:px-6 lg:px-8 py-3 bg-bg/90 backdrop-blur border-b border-border/40">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Time Range */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="Search SKU, title, platform..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => updateParams({ q: searchQuery || undefined })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateParams({ q: searchQuery || undefined })
                  }
                }}
                className={cn(
                  'pl-9 bg-elev-0 border-border transition-all duration-120 text-fg',
                  searchQuery && 'ring-2 ring-accent/40'
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              {(['all', '7d', '30d', '90d'] as TimeRangeType[]).map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range)
                    updateParams({ timeRange: range === 'all' ? undefined : range })
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    timeRange === range
                      ? 'bg-accent/20 text-fg border border-accent/40'
                      : 'bg-elev-1 text-dim hover:text-fg hover:bg-elev-2'
                  )}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted">
              {loading && <span>Loading...</span>}
              {!loading && data && data.rows.length > 0 && (
                <span>
                  {data.rows.length} {data.rows.length === 1 ? 'transaction' : 'transactions'}
                </span>
              )}
              {activeFilterCount > 0 && (
                <>
                  <span className="text-border">•</span>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setTimeRange('all')
                      updateParams({ q: undefined, timeRange: undefined })
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
                disabled={!data || data.rows.length === 0}
                size="sm"
                className="max-md:hidden"
              >
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="border-l-4 border-l-danger bg-elev-1 p-4 rounded-lg">
          <p className="text-sm text-danger font-medium">Error: {error}</p>
        </div>
      )}

      {/* Transactions Table */}
      <TransactionsTable
        rows={data?.rows || []}
        loading={loading}
        type={tab}
        onEdit={(tx) => setEditingTransaction(tx)}
      />

      {/* Empty State */}
      {!loading && data && data.rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="bg-elev-1 rounded-full p-6 mb-4">
            {tab === 'sales' ? (
              <TrendingUp className="h-12 w-12 text-muted" />
            ) : (
              <ShoppingBag className="h-12 w-12 text-muted" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-fg mb-2">
            No {tab === 'sales' ? 'sales' : 'purchases'} yet
          </h3>
          <p className="text-sm text-muted mb-4 text-center max-w-sm">
            {tab === 'sales'
              ? 'When you mark items as sold, they will appear here with profit tracking.'
              : 'When you add items to your portfolio, purchase records will appear here.'}
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/portfolio/inventory')}
              className="border-accent text-accent hover:bg-accent/10"
            >
              Go to Portfolio
            </Button>
            {tab === 'sales' && (
              <button
                onClick={() => handleTabChange('purchases')}
                className="text-sm text-accent hover:underline"
              >
                View Purchases →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => {
            setEditingTransaction(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
