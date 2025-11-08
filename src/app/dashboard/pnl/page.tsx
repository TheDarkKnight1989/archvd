'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePnLKPIs, usePnLItems, usePnLExpenses, useVATSummary } from '@/hooks/usePnL'
import { supabase } from '@/lib/supabase/client'
import { toCsv, downloadCsv, formatGbpForCsv, formatDateForCsv } from '@/lib/export/csv'
import useRequireAuth from '@/hooks/useRequireAuth'

type MonthTab = 'this' | 'last' | 'custom'

export default function PnLPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<MonthTab>('this')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to current month or URL param
    if (typeof window === 'undefined') return new Date().toISOString().slice(0, 7)
    const urlMonth = searchParams?.get('month')
    return urlMonth || new Date().toISOString().slice(0, 7)
  })

  // Log session for debugging
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[PnL] session user id:', session?.user?.id)
    })()
  }, [])

  // Sync month with URL
  useEffect(() => {
    if (searchParams) {
      const urlMonth = searchParams.get('month')
      if (urlMonth && urlMonth !== selectedMonth) {
        setSelectedMonth(urlMonth)
      }
    }
  }, [searchParams])

  // Fetch all data (no date filter)
  const pnlKPIsRaw = usePnLKPIs(user?.id)
  const pnlItemsRaw = usePnLItems(user?.id)
  const pnlExpenses = usePnLExpenses(user?.id, selectedMonth) // Keep month filter for expenses
  const vatSummaryRaw = useVATSummary(user?.id)

  // Compute month key for filtering (YYYY-MM)
  const monthKey = selectedMonth // Already in YYYY-MM format

  // Debug logs with errors
  console.log('[PnL] kpiData', pnlKPIsRaw.data, pnlKPIsRaw.error)
  console.log('[PnL] vatSummary', vatSummaryRaw.data, vatSummaryRaw.error)
  console.log('[PnL] itemsData', pnlItemsRaw.data, pnlItemsRaw.error)
  console.log('[PnL] monthKey', monthKey)

  // Filter data by month in JavaScript
  const kpiRow = pnlKPIsRaw.data?.find((r: any) => String(r.month).slice(0, 7) === monthKey)
  const vatRow = vatSummaryRaw.data?.find((r: any) => String(r.month).slice(0, 7) === monthKey)
  const detailRows = (pnlItemsRaw.data || []).filter((r: any) => {
    // Use sold_date (from view) or date (from mapped type)
    const dateValue = r.sold_date || r.date
    if (!dateValue) return false
    return String(dateValue).slice(0, 7) === monthKey
  })

  // Build filtered data objects
  const pnlKPIs = {
    loading: pnlKPIsRaw.loading,
    error: pnlKPIsRaw.error,
    data: kpiRow ? {
      revenue: kpiRow.revenue || 0,
      cogs: kpiRow.cogs || 0,
      grossProfit: kpiRow.gross_profit || 0,
      expenses: kpiRow.expenses || 0,
      netProfit: kpiRow.net_profit || 0,
      numSales: kpiRow.num_sales || 0,
    } : {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      expenses: 0,
      netProfit: 0,
      numSales: 0,
    }
  }

  const vatSummary = {
    loading: vatSummaryRaw.loading,
    error: vatSummaryRaw.error,
    data: vatRow ? {
      totalSales: vatRow.total_sales || 0,
      totalMargin: vatRow.total_margin || 0,
      taxableMargin: vatRow.taxable_margin || 0,
      vatDue: vatRow.vat_due || 0,
      numSales: vatRow.num_sales || 0,
      totalVatDue: vatRow.vat_due || 0,
    } : {
      totalSales: 0,
      totalMargin: 0,
      taxableMargin: 0,
      vatDue: 0,
      numSales: 0,
      totalVatDue: 0,
    }
  }

  const pnlItems = {
    loading: pnlItemsRaw.loading,
    error: pnlItemsRaw.error,
    data: detailRows
  }

  const handleMonthChange = (tab: MonthTab, month?: string) => {
    setActiveTab(tab)
    let newMonth = month

    if (tab === 'this') {
      newMonth = new Date().toISOString().slice(0, 7)
    } else if (tab === 'last') {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      newMonth = lastMonth.toISOString().slice(0, 7)
    }

    if (newMonth) {
      setSelectedMonth(newMonth)
      router.replace(`/dashboard/pnl?month=${newMonth}`, { scroll: false })
    }
  }

  const handleExportPnL = () => {
    // Export P&L items (sold items with margin and VAT)
    const rows = pnlItems.data.map(item => ({
      Date: formatDateForCsv(item.date),
      SKU: item.sku,
      Brand: item.brand,
      Model: item.model,
      Size: item.size,
      'Buy Price': formatGbpForCsv(item.buyPrice),
      'Sale Price': formatGbpForCsv(item.salePrice),
      'Margin': formatGbpForCsv(item.margin),
      'VAT Due': formatGbpForCsv(item.vatDue),
      'Platform': item.platform || '',
    }))

    const headers = ['Date', 'SKU', 'Brand', 'Model', 'Size', 'Buy Price', 'Sale Price', 'Margin', 'VAT Due', 'Platform']
    const csv = toCsv(rows, headers)
    const filename = `archvd-pnl-${selectedMonth}.csv`
    downloadCsv(filename, csv)
  }

  const handleExportVATDetail = () => {
    // Export VAT detail (same as P&L items, focused on VAT)
    const rows = pnlItems.data.map(item => ({
      Date: formatDateForCsv(item.date),
      SKU: item.sku,
      Brand: item.brand,
      Model: item.model,
      Size: item.size,
      'Buy Price': formatGbpForCsv(item.buyPrice),
      'Sale Price': formatGbpForCsv(item.salePrice),
      'Margin': formatGbpForCsv(item.margin),
      'VAT Due': formatGbpForCsv(item.vatDue),
      'Platform': item.platform || '',
    }))

    const headers = ['Date', 'SKU', 'Brand', 'Model', 'Size', 'Buy Price', 'Sale Price', 'Margin', 'VAT Due', 'Platform']
    const csv = toCsv(rows, headers)
    const filename = `archvd-vat-detail-${selectedMonth}.csv`
    downloadCsv(filename, csv)
  }

  const handleExportVATSummary = () => {
    // Export VAT summary (monthly totals)
    const rows = [{
      Month: selectedMonth,
      'Total Sales': formatGbpForCsv(vatSummary.data.totalSales),
      'Total Margin': formatGbpForCsv(vatSummary.data.totalMargin),
      'VAT Due': formatGbpForCsv(vatSummary.data.totalVatDue),
      'Number of Sales': vatSummary.data.numSales,
    }]

    const headers = ['Month', 'Total Sales', 'Total Margin', 'VAT Due', 'Number of Sales']
    const csv = toCsv(rows, headers)
    const filename = `archvd-vat-summary-${selectedMonth}.csv`
    downloadCsv(filename, csv)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  // Guard: show loading while auth resolves
  if (authLoading) {
    return <div className="p-6 text-dim">Loading...</div>
  }

  // Guard: redirect handled by useRequireAuth
  if (!user) {
    return null
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg relative inline-block">
            Profit & Loss
            <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
          </h1>
          <p className="text-sm text-dim mt-1">Monthly P&L and VAT reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPnL}>
            <Download className="h-4 w-4 mr-2" />
            P&L CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportVATDetail}>
            <Download className="h-4 w-4 mr-2" />
            VAT Detail
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportVATSummary}>
            <Download className="h-4 w-4 mr-2" />
            VAT Summary
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-xl p-1">
          <button
            onClick={() => handleMonthChange('this')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'this'
                ? 'bg-accent-200 text-fg border border-accent-400'
                : 'text-dim hover:text-fg hover:bg-surface2 hover:outline hover:outline-1 hover:outline-accent-400/40'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleMonthChange('last')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'last'
                ? 'bg-accent-200 text-fg border border-accent-400'
                : 'text-dim hover:text-fg hover:bg-surface2 hover:outline hover:outline-1 hover:outline-accent-400/40'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-accent-200 text-fg border border-accent-400'
                : 'text-dim hover:text-fg hover:bg-surface2 hover:outline hover:outline-1 hover:outline-accent-400/40'
            }`}
          >
            Custom
          </button>
        </div>
        {activeTab === 'custom' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => handleMonthChange('custom', e.target.value)}
            className="px-4 py-2 rounded-xl border border-border bg-bg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-focus"
          />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(15,141,101,0.2)]">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Revenue</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlKPIs.loading ? '...' : formatCurrency(pnlKPIs.data.revenue)}
          </div>
          <div className="text-xs text-dim mt-1">{pnlKPIs.data.numSales} sales</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(15,141,101,0.2)]">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">COGS</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlKPIs.loading ? '...' : formatCurrency(pnlKPIs.data.cogs)}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(15,141,101,0.2)]">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Gross Profit</div>
          <div className="text-2xl font-bold text-accent font-mono">
            {pnlKPIs.loading ? '...' : formatCurrency(pnlKPIs.data.grossProfit)}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(15,141,101,0.2)]">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Expenses</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlKPIs.loading ? '...' : formatCurrency(pnlKPIs.data.expenses)}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 shadow-[inset_0_0_0_1px_rgba(15,141,101,0.2)]">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Net Profit</div>
          <div className={`text-2xl font-bold font-mono inline-flex items-center gap-2 ${pnlKPIs.data.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
            {pnlKPIs.data.netProfit > 0 && <TrendingUp className="h-6 w-6" />}
            {pnlKPIs.data.netProfit < 0 && <TrendingDown className="h-6 w-6" />}
            {pnlKPIs.loading ? '...' : formatCurrency(pnlKPIs.data.netProfit)}
          </div>
        </div>
      </div>

      {/* Sold Items Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Sold Items</h2>
          <p className="text-xs text-dim mt-0.5">Items sold in {new Date(selectedMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface2 border-b border-border border-t border-t-accent-400/25">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Size</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">Buy £</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">Sale £</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">Margin £</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">VAT Due £</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pnlItems.loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-dim">
                    Loading...
                  </td>
                </tr>
              ) : pnlItems.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-dim">
                    No sales in this month
                  </td>
                </tr>
              ) : (
                pnlItems.data.map((item) => (
                  <tr key={item.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3 text-sm text-fg">{formatDate(item.date)}</td>
                    <td className="px-4 py-3 text-sm text-fg font-mono">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-fg">
                      <div className="font-medium">{item.brand}</div>
                      <div className="text-xs text-dim">{item.model}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg">UK {item.size}</td>
                    <td className="px-4 py-3 text-sm text-fg text-right">{formatCurrency(item.buyPrice)}</td>
                    <td className="px-4 py-3 text-sm text-fg text-right">{formatCurrency(item.salePrice)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${item.margin >= 0 ? 'text-success' : 'text-danger'}`}>
                      <div className="inline-flex items-center gap-1">
                        {item.margin > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                        {item.margin < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                        {formatCurrency(item.margin)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-accent text-right font-medium">{formatCurrency(item.vatDue)}</td>
                    <td className="px-4 py-3 text-sm text-dim">{item.platform || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VAT Summary */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold text-fg mb-4">VAT Margin Scheme Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Total Sales</div>
            <div className="text-xl font-bold text-fg">
              {vatSummary.loading ? '...' : formatCurrency(vatSummary.data.totalSales)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Total Margin</div>
            <div className="text-xl font-bold text-fg">
              {vatSummary.loading ? '...' : formatCurrency(vatSummary.data.totalMargin)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Taxable Margin</div>
            <div className="text-xl font-bold text-fg">
              {vatSummary.loading ? '...' : formatCurrency(vatSummary.data.taxableMargin)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">VAT Due</div>
            <div className="text-xl font-bold text-accent">
              {vatSummary.loading ? '...' : formatCurrency(vatSummary.data.vatDue)}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Expenses</h2>
          <p className="text-xs text-dim mt-0.5">Expenses recorded in {new Date(selectedMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface2 border-b border-border border-t border-t-accent-400/25">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">Amount £</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pnlExpenses.loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-dim">
                    Loading...
                  </td>
                </tr>
              ) : pnlExpenses.data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-dim">
                    No expenses in this month
                  </td>
                </tr>
              ) : (
                pnlExpenses.data.map((expense) => (
                  <tr key={expense.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3 text-sm text-fg">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3 text-sm text-fg">{expense.description}</td>
                    <td className="px-4 py-3 text-sm text-dim">{expense.category}</td>
                    <td className="px-4 py-3 text-sm text-fg text-right">{formatCurrency(expense.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
