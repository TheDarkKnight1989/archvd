'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePnLItems, usePnLExpenses } from '@/hooks/usePnL'
import { supabase } from '@/lib/supabase/client'
import { toCsv, downloadCsv, formatGbpForCsv, formatDateForCsv } from '@/lib/export/csv'
import {
  type DateRangePreset,
  type DateRange,
  getPresetRange,
  getPresetLabel,
  formatRangeDisplay,
  formatRangeFilename,
  isDateInRange,
  formatDate as formatDateYMD,
} from '@/lib/date/range'
import useRequireAuth from '@/hooks/useRequireAuth'

const PRESETS: DateRangePreset[] = ['this-month', 'last-30', 'last-90', 'ytd', 'custom']

export default function PnLPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL or defaults
  const [preset, setPreset] = useState<DateRangePreset>(() => {
    const urlPreset = searchParams?.get('preset') as DateRangePreset | null
    return urlPreset && PRESETS.includes(urlPreset) ? urlPreset : 'this-month'
  })

  const [customFrom, setCustomFrom] = useState<string>(() => {
    const urlFrom = searchParams?.get('from')
    if (urlFrom) return urlFrom
    // Default to first day of current month
    const today = new Date()
    return formatDateYMD(new Date(today.getFullYear(), today.getMonth(), 1))
  })

  const [customTo, setCustomTo] = useState<string>(() => {
    const urlTo = searchParams?.get('to')
    if (urlTo) return urlTo
    // Default to today
    return formatDateYMD(new Date())
  })

  // Compute active date range
  const dateRange = useMemo<DateRange>(() => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return getPresetRange(preset) || { from: customFrom, to: customTo }
  }, [preset, customFrom, customTo])

  // Log session for debugging
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[PnL] session user id:', session?.user?.id)
    })()
  }, [])

  // Sync URL params whenever range changes
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('preset', preset)
    if (preset === 'custom') {
      params.set('from', customFrom)
      params.set('to', customTo)
    }
    router.replace(`/portfolio/pnl?${params.toString()}`, { scroll: false })
  }, [preset, customFrom, customTo, router])

  // Fetch ALL data (no server-side date filtering)
  const pnlItemsRaw = usePnLItems(user?.id)
  const pnlExpensesRaw = usePnLExpenses(user?.id, null) // Pass null to fetch all expenses

  // Client-side filter items by date range
  const filteredItems = useMemo(() => {
    if (!pnlItemsRaw.data) return []

    return pnlItemsRaw.data.filter((item: any) => {
      const dateValue = item.date
      if (!dateValue) return false

      // Extract YYYY-MM-DD from date string
      const itemDate = String(dateValue).slice(0, 10)
      return isDateInRange(itemDate, dateRange)
    })
  }, [pnlItemsRaw.data, dateRange])

  // Client-side filter expenses by date range
  const filteredExpenses = useMemo(() => {
    if (!pnlExpensesRaw.data) return []

    return pnlExpensesRaw.data.filter((expense: any) => {
      const dateValue = expense.date
      if (!dateValue) return false

      const expenseDate = String(dateValue).slice(0, 10)
      return isDateInRange(expenseDate, dateRange)
    })
  }, [pnlExpensesRaw.data, dateRange])

  // Compute KPIs from filtered items
  const kpis = useMemo(() => {
    const revenue = filteredItems.reduce((sum, item) => sum + (item.salePrice || 0), 0)
    const cogs = filteredItems.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const grossProfit = revenue - cogs
    const expenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
    const netProfit = grossProfit - expenses
    const numSales = filteredItems.length

    return { revenue, cogs, grossProfit, expenses, netProfit, numSales }
  }, [filteredItems, filteredExpenses])

  // Compute VAT summary from filtered items
  const vatSummary = useMemo(() => {
    const totalSales = filteredItems.reduce((sum, item) => sum + (item.salePrice || 0), 0)
    const totalMargin = filteredItems.reduce((sum, item) => sum + (item.margin || 0), 0)
    const vatDue = filteredItems.reduce((sum, item) => sum + (item.vatDue || 0), 0)
    const numSales = filteredItems.length

    // Taxable margin = total margin (for VAT Margin Scheme)
    const taxableMargin = totalMargin

    return { totalSales, totalMargin, taxableMargin, vatDue, numSales }
  }, [filteredItems])

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset)

    // If switching to custom, ensure we have valid dates
    if (newPreset === 'custom') {
      if (!customFrom || !customTo) {
        const today = new Date()
        setCustomFrom(formatDateYMD(new Date(today.getFullYear(), today.getMonth(), 1)))
        setCustomTo(formatDateYMD(today))
      }
    }
  }

  const handleExportPnL = () => {
    const rows = filteredItems.map((item: any) => ({
      Date: formatDateForCsv(item.date),
      SKU: item.sku || '',
      Brand: item.brand || '',
      Model: item.model || '',
      Size: item.size || '',
      'Buy Price': formatGbpForCsv(item.buyPrice || 0),
      'Sale Price': formatGbpForCsv(item.salePrice || 0),
      'Margin': formatGbpForCsv(item.margin || 0),
      'VAT Due': formatGbpForCsv(item.vatDue || 0),
      'Platform': item.platform || '',
    }))

    const headers = ['Date', 'SKU', 'Brand', 'Model', 'Size', 'Buy Price', 'Sale Price', 'Margin', 'VAT Due', 'Platform']
    const csv = toCsv(rows, headers)
    const filename = `archvd-pnl-${formatRangeFilename(dateRange)}.csv`
    downloadCsv(filename, csv)
  }

  const handleExportVATDetail = () => {
    const rows = filteredItems.map((item: any) => ({
      Date: formatDateForCsv(item.date),
      SKU: item.sku || '',
      Brand: item.brand || '',
      Model: item.model || '',
      Size: item.size || '',
      'Buy Price': formatGbpForCsv(item.buyPrice || 0),
      'Sale Price': formatGbpForCsv(item.salePrice || 0),
      'Margin': formatGbpForCsv(item.margin || 0),
      'VAT Due': formatGbpForCsv(item.vatDue || 0),
      'Platform': item.platform || '',
    }))

    const headers = ['Date', 'SKU', 'Brand', 'Model', 'Size', 'Buy Price', 'Sale Price', 'Margin', 'VAT Due', 'Platform']
    const csv = toCsv(rows, headers)
    const filename = `archvd-vat-detail-${formatRangeFilename(dateRange)}.csv`
    downloadCsv(filename, csv)
  }

  const handleExportVATSummary = () => {
    const rows = [{
      Range: formatRangeDisplay(dateRange),
      'Total Sales': formatGbpForCsv(vatSummary.totalSales),
      'Total Margin': formatGbpForCsv(vatSummary.totalMargin),
      'VAT Due': formatGbpForCsv(vatSummary.vatDue),
      'Number of Sales': vatSummary.numSales,
    }]

    const headers = ['Range', 'Total Sales', 'Total Margin', 'VAT Due', 'Number of Sales']
    const csv = toCsv(rows, headers)
    const filename = `archvd-vat-summary-${formatRangeFilename(dateRange)}.csv`
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

      {/* Date Range Selector */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 bg-elev-1 border border-border rounded-xl p-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => handlePresetChange(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                preset === p
                  ? 'bg-accent-200 text-fg border border-accent-400 glow-accent-hover'
                  : 'text-dim hover:text-fg hover:bg-elev-2 hover:outline hover:outline-1 hover:outline-accent-400/40'
              }`}
            >
              {getPresetLabel(p)}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs */}
        {preset === 'custom' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">From:</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-auto bg-bg border-border text-fg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">To:</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-auto bg-bg border-border text-fg text-sm"
              />
            </div>
          </div>
        )}

        {/* Range Display */}
        <div className="flex items-center gap-2 text-sm text-dim">
          <Calendar className="h-4 w-4" />
          <span>Showing: {formatRangeDisplay(dateRange)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-elev-2 gradient-elev glow-accent-hover border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Revenue</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlItemsRaw.loading || pnlExpensesRaw.loading ? '...' : formatCurrency(kpis.revenue)}
          </div>
          <div className="text-xs text-dim mt-1">{kpis.numSales} sales</div>
        </div>
        <div className="bg-elev-2 gradient-elev glow-accent-hover border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">COGS</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlItemsRaw.loading || pnlExpensesRaw.loading ? '...' : formatCurrency(kpis.cogs)}
          </div>
        </div>
        <div className="bg-elev-2 gradient-elev glow-accent-hover border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Gross Profit</div>
          <div className="text-2xl font-bold text-accent font-mono">
            {pnlItemsRaw.loading || pnlExpensesRaw.loading ? '...' : formatCurrency(kpis.grossProfit)}
          </div>
        </div>
        <div className="bg-elev-2 gradient-elev glow-accent-hover border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Expenses</div>
          <div className="text-2xl font-bold text-fg font-mono">
            {pnlItemsRaw.loading || pnlExpensesRaw.loading ? '...' : formatCurrency(kpis.expenses)}
          </div>
        </div>
        <div className="bg-elev-2 gradient-elev glow-accent-hover border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Net Profit</div>
          <div className={`text-2xl font-bold font-mono inline-flex items-center gap-2 ${kpis.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
            {kpis.netProfit > 0 && <TrendingUp className="h-6 w-6" />}
            {kpis.netProfit < 0 && <TrendingDown className="h-6 w-6" />}
            {pnlItemsRaw.loading || pnlExpensesRaw.loading ? '...' : formatCurrency(kpis.netProfit)}
          </div>
        </div>
      </div>

      {/* Sold Items Table */}
      <div className="bg-elev-1 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Sold Items</h2>
          <p className="text-xs text-dim mt-0.5">Items sold in {formatRangeDisplay(dateRange)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-elev-2 border-b border-border border-t border-t-accent-400/25">
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
              {pnlItemsRaw.loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-dim">
                    Loading...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-dim">
                    No sales in this period
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-elev-2 transition-colors">
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
      <div className="bg-elev-1 border border-border rounded-xl p-4">
        <h2 className="text-lg font-semibold text-fg mb-4">VAT Margin Scheme Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Total Sales</div>
            <div className="text-xl font-bold text-fg">
              {pnlItemsRaw.loading ? '...' : formatCurrency(vatSummary.totalSales)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Total Margin</div>
            <div className="text-xl font-bold text-fg">
              {pnlItemsRaw.loading ? '...' : formatCurrency(vatSummary.totalMargin)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Taxable Margin</div>
            <div className="text-xl font-bold text-fg">
              {pnlItemsRaw.loading ? '...' : formatCurrency(vatSummary.taxableMargin)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">VAT Due</div>
            <div className="text-xl font-bold text-accent">
              {pnlItemsRaw.loading ? '...' : formatCurrency(vatSummary.vatDue)}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-elev-1 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-fg">Expenses</h2>
          <p className="text-xs text-dim mt-0.5">Expenses recorded in {formatRangeDisplay(dateRange)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-elev-2 border-b border-border border-t border-t-accent-400/25">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">Amount £</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pnlExpensesRaw.loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-dim">
                    Loading...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-dim">
                    No expenses in this period
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-elev-2 transition-colors">
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
