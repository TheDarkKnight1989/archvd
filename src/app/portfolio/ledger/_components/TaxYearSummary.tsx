/**
 * Tax Year Summary Component
 * Shows tax year calculations, quarterly breakdowns, and export options
 */

'use client'

import { useMemo, useState } from 'react'
import { Calendar, Download, FileText, TrendingUp, Info } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface TaxYearSummaryProps {
  items: SalesItem[]
  className?: string
  taxYearStart?: 'january' | 'april' // US: January, UK: April
}

interface QuarterData {
  quarter: string
  revenue: number
  profit: number
  sales: number
  fees: number
  cogs: number
}

export function TaxYearSummary({
  items,
  className,
  taxYearStart = 'april', // Default to UK tax year
}: TaxYearSummaryProps) {
  const { convert, format } = useCurrency()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Calculate tax year dates
  const taxYear = useMemo(() => {
    const startMonth = taxYearStart === 'april' ? 3 : 0 // April = 3, January = 0
    const start = new Date(selectedYear, startMonth, 1)
    const end = new Date(selectedYear + 1, startMonth, 0) // Last day of previous month

    return { start, end, label: `${selectedYear}/${(selectedYear + 1).toString().slice(2)}` }
  }, [selectedYear, taxYearStart])

  // Filter items for current tax year
  const taxYearItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.sold_date) return false
      const saleDate = new Date(item.sold_date)
      return saleDate >= taxYear.start && saleDate <= taxYear.end
    })
  }, [items, taxYear])

  // Calculate quarterly data
  const quarterlyData = useMemo((): QuarterData[] => {
    const quarters: QuarterData[] = []
    const startMonth = taxYearStart === 'april' ? 3 : 0

    for (let q = 0; q < 4; q++) {
      const qStart = new Date(selectedYear, startMonth + (q * 3), 1)
      const qEnd = new Date(selectedYear, startMonth + ((q + 1) * 3), 0)

      const qItems = taxYearItems.filter((item) => {
        if (!item.sold_date) return false
        const date = new Date(item.sold_date)
        return date >= qStart && date <= qEnd
      })

      const revenue = qItems.reduce((sum, item) => sum + convert(item.sold_price || 0, 'GBP'), 0)
      const profit = qItems.reduce((sum, item) => sum + convert(item.margin_gbp || 0, 'GBP'), 0)
      const fees = qItems.reduce((sum, item) => sum + convert(item.sales_fee || 0, 'GBP'), 0)
      const cogs = qItems.reduce((sum, item) =>
        sum + convert((item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0), 'GBP'), 0
      )

      quarters.push({
        quarter: `Q${q + 1}`,
        revenue,
        profit,
        sales: qItems.length,
        fees,
        cogs,
      })
    }

    return quarters
  }, [taxYearItems, selectedYear, taxYearStart, convert])

  // Total tax year metrics
  const taxYearTotals = useMemo(() => {
    const revenue = taxYearItems.reduce((sum, item) => sum + convert(item.sold_price || 0, 'GBP'), 0)
    const profit = taxYearItems.reduce((sum, item) => sum + convert(item.margin_gbp || 0, 'GBP'), 0)
    const fees = taxYearItems.reduce((sum, item) => sum + convert(item.sales_fee || 0, 'GBP'), 0)
    const cogs = taxYearItems.reduce((sum, item) =>
      sum + convert((item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0), 'GBP'), 0
    )

    return {
      revenue,
      profit,
      fees,
      cogs,
      sales: taxYearItems.length,
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    }
  }, [taxYearItems, convert])

  // Export tax report
  const exportTaxReport = () => {
    const csvRows: string[] = []

    // Header
    csvRows.push(`Tax Year ${taxYear.label} - Sales Report`)
    csvRows.push(`Generated: ${new Date().toLocaleDateString()}`)
    csvRows.push('') // Empty line

    // Summary
    csvRows.push('SUMMARY')
    csvRows.push(`Total Revenue,${taxYearTotals.revenue.toFixed(2)}`)
    csvRows.push(`Total COGS,${taxYearTotals.cogs.toFixed(2)}`)
    csvRows.push(`Total Fees,${taxYearTotals.fees.toFixed(2)}`)
    csvRows.push(`Net Profit,${taxYearTotals.profit.toFixed(2)}`)
    csvRows.push(`Number of Sales,${taxYearTotals.sales}`)
    csvRows.push(`Profit Margin,${taxYearTotals.margin.toFixed(2)}%`)
    csvRows.push('') // Empty line

    // Quarterly breakdown
    csvRows.push('QUARTERLY BREAKDOWN')
    csvRows.push('Quarter,Revenue,COGS,Fees,Profit,Sales')
    quarterlyData.forEach((q) => {
      csvRows.push(`${q.quarter},${q.revenue.toFixed(2)},${q.cogs.toFixed(2)},${q.fees.toFixed(2)},${q.profit.toFixed(2)},${q.sales}`)
    })
    csvRows.push('') // Empty line

    // Detailed transactions
    csvRows.push('DETAILED TRANSACTIONS')
    csvRows.push('Date,SKU,Brand,Model,Platform,Sale Price,Purchase Price,Fees,Profit')
    taxYearItems.forEach((item) => {
      const row = [
        item.sold_date || '',
        item.sku || '',
        item.brand || '',
        item.model || '',
        item.platform || '',
        (item.sold_price || 0).toFixed(2),
        ((item.purchase_price || 0) + (item.tax || 0) + (item.shipping || 0)).toFixed(2),
        (item.sales_fee || 0).toFixed(2),
        (item.margin_gbp || 0).toFixed(2),
      ]
      csvRows.push(row.join(','))
    })

    // Create and download
    const csv = csvRows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tax-report-${taxYear.label}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-fg uppercase tracking-wide mb-1 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#00FF94]" />
            Tax Year Summary
          </h3>
          <p className="text-xs text-muted">
            {taxYearStart === 'april' ? 'UK Tax Year' : 'US Tax Year'} {taxYear.label}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportTaxReport}
          className="border-[#00FF94]/30 text-[#00FF94] hover:bg-[#00FF94]/10"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export Report
        </Button>
      </div>

      {/* Tax Year Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-elev-0 rounded-lg p-3 border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Revenue</div>
          <div className="text-xl font-bold text-fg mono">{format(taxYearTotals.revenue)}</div>
        </div>
        <div className="bg-elev-0 rounded-lg p-3 border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">COGS</div>
          <div className="text-xl font-bold text-fg mono">{format(taxYearTotals.cogs)}</div>
        </div>
        <div className="bg-elev-0 rounded-lg p-3 border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Net Profit</div>
          <div className={cn(
            "text-xl font-bold mono",
            taxYearTotals.profit >= 0 ? "text-[#00FF94]" : "text-red-400"
          )}>
            {format(taxYearTotals.profit)}
          </div>
        </div>
        <div className="bg-elev-0 rounded-lg p-3 border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Sales</div>
          <div className="text-xl font-bold text-fg mono">{taxYearTotals.sales}</div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-xs font-semibold text-dim uppercase tracking-wide">Quarterly Breakdown</h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted hover:text-fg transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs bg-[#0E1A15] border-[#15251B] p-3">
                <div className="text-xs space-y-2">
                  <div className="font-semibold text-[#00FF94] mb-2">
                    {taxYearStart === 'april' ? 'UK Fiscal Quarters' : 'US Fiscal Quarters'}
                  </div>
                  {taxYearStart === 'april' ? (
                    <div className="space-y-1 text-[#E8F6EE]">
                      <div><span className="font-bold text-cyan-400">Q1:</span> Apr 1 - Jun 30</div>
                      <div><span className="font-bold text-cyan-400">Q2:</span> Jul 1 - Sep 30</div>
                      <div><span className="font-bold text-cyan-400">Q3:</span> Oct 1 - Dec 31</div>
                      <div><span className="font-bold text-cyan-400">Q4:</span> Jan 1 - Mar 31</div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[#E8F6EE]">
                      <div><span className="font-bold text-cyan-400">Q1:</span> Jan 1 - Mar 31</div>
                      <div><span className="font-bold text-cyan-400">Q2:</span> Apr 1 - Jun 30</div>
                      <div><span className="font-bold text-cyan-400">Q3:</span> Jul 1 - Sep 30</div>
                      <div><span className="font-bold text-cyan-400">Q4:</span> Oct 1 - Dec 31</div>
                    </div>
                  )}
                  <div className="text-[#7FA08F] mt-2 pt-2 border-t border-[#15251B]">
                    Based on your tax year setting ({taxYearStart === 'april' ? 'UK' : 'US'})
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {quarterlyData.map((q) => (
            <div
              key={q.quarter}
              className="bg-elev-0 rounded-lg p-3 border border-border/30 hover:border-[#00FF94]/30 transition-all"
            >
              <div className="text-sm font-bold text-[#00FF94] mb-2">{q.quarter}</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-dim">Revenue</span>
                  <span className="font-bold text-fg mono">{format(q.revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Profit</span>
                  <span className={cn(
                    "font-bold mono",
                    q.profit >= 0 ? "text-[#00FF94]" : "text-red-400"
                  )}>
                    {format(q.profit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Sales</span>
                  <span className="font-bold text-fg mono">{q.sales}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Notes */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-blue-400 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-blue-400 mb-1">Tax Reporting Notes</p>
            <p className="text-muted leading-relaxed">
              This summary is for reference only. Consult with a tax professional for official reporting.
              Capital gains may apply. Export the detailed report for your accountant.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
