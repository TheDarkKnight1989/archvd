/**
 * Advanced Export Options Component
 * PDF reports, enhanced CSV exports, and scheduled reporting
 */

'use client'

import { useState } from 'react'
import { Download, FileText, Calendar, Mail, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface AdvancedExportsProps {
  items: any[]
  expenses: any[]
  kpis: {
    revenue: number
    cogs: number
    grossProfit: number
    expenses: number
    netProfit: number
    numSales: number
  }
  vatSummary: {
    totalSales: number
    totalMargin: number
    vatDue: number
  }
  dateRange: { from: string; to: string }
  formatCurrency: (value: number) => string
  onExport?: (type: string) => void
  className?: string
}

export function AdvancedExports({
  items,
  expenses,
  kpis,
  vatSummary,
  dateRange,
  formatCurrency,
  onExport,
  className
}: AdvancedExportsProps) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const handleExport = async (type: 'pdf-comprehensive' | 'pdf-summary' | 'csv-detailed' | 'csv-tax') => {
    setGenerating(type)

    try {
      // In a real implementation, this would call an API to generate the export
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (type === 'pdf-comprehensive') {
        await generateComprehensivePDF()
      } else if (type === 'pdf-summary') {
        await generateSummaryPDF()
      } else if (type === 'csv-detailed') {
        await generateDetailedCSV()
      } else if (type === 'csv-tax') {
        await generateTaxCSV()
      }

      onExport?.(type)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  const generateComprehensivePDF = async () => {
    // This would use a library like jsPDF or react-pdf
    alert('PDF export would be generated here. Includes:\n\n- Executive summary\n- Detailed P&L statement\n- Cash flow analysis\n- Performance insights\n- Charts and visualizations')
  }

  const generateSummaryPDF = async () => {
    alert('Summary PDF would be generated here. Includes:\n\n- Key metrics overview\n- Period comparison\n- Top insights')
  }

  const generateDetailedCSV = async () => {
    alert('Detailed CSV would be generated here. Includes:\n\n- Transaction-level data\n- Extended metadata\n- Calculated fields')
  }

  const generateTaxCSV = async () => {
    alert('Tax CSV would be generated here. Includes:\n\n- VAT summary\n- Income breakdown\n- Expense categorization\n- HMRC-ready format')
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Advanced Exports</h3>
            <p className="text-sm text-muted mt-0.5">Professional reports and data exports</p>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-3">
        {/* PDF Reports */}
        <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-red-400" />
            <h4 className="text-sm font-semibold text-fg">PDF Reports</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={() => handleExport('pdf-comprehensive')}
              disabled={generating !== null}
              variant="outline"
              size="sm"
              className="justify-start bg-elev-1 border-border hover:border-accent/40"
            >
              {generating === 'pdf-comprehensive' ? (
                <>Generating...</>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2 text-red-400" />
                  Comprehensive Report
                </>
              )}
            </Button>
            <Button
              onClick={() => handleExport('pdf-summary')}
              disabled={generating !== null}
              variant="outline"
              size="sm"
              className="justify-start bg-elev-1 border-border hover:border-accent/40"
            >
              {generating === 'pdf-summary' ? (
                <>Generating...</>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2 text-red-400" />
                  Executive Summary
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted">
            Professional PDF reports with charts, insights, and detailed breakdowns
          </div>
        </div>

        {/* Enhanced CSV Exports */}
        <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Download className="h-4 w-4 text-[#00FF94]" />
            <h4 className="text-sm font-semibold text-fg">Enhanced CSV Exports</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={() => handleExport('csv-detailed')}
              disabled={generating !== null}
              variant="outline"
              size="sm"
              className="justify-start bg-elev-1 border-border hover:border-accent/40"
            >
              {generating === 'csv-detailed' ? (
                <>Generating...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2 text-[#00FF94]" />
                  Detailed Transactions
                </>
              )}
            </Button>
            <Button
              onClick={() => handleExport('csv-tax')}
              disabled={generating !== null}
              variant="outline"
              size="sm"
              className="justify-start bg-elev-1 border-border hover:border-accent/40"
            >
              {generating === 'csv-tax' ? (
                <>Generating...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2 text-[#00FF94]" />
                  Tax Report (HMRC)
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted">
            Extended CSV exports with calculated fields and metadata
          </div>
        </div>

        {/* Scheduled Reports */}
        <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              <h4 className="text-sm font-semibold text-purple-400">Scheduled Reports</h4>
            </div>
            <Button
              onClick={() => setScheduleOpen(!scheduleOpen)}
              variant="outline"
              size="sm"
              className="border-purple-500/30 hover:border-purple-500/50 text-purple-400"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
          <div className="text-xs text-purple-400">
            Automatically email reports weekly or monthly (Coming soon)
          </div>

          {scheduleOpen && (
            <div className="mt-3 p-3 bg-elev-1 rounded border border-purple-500/20">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Weekly Summary</span>
                  <span className="text-dim">Not configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Monthly Report</span>
                  <span className="text-dim">Not configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Quarterly Review</span>
                  <span className="text-dim">Not configured</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 border-purple-500/30"
                disabled
              >
                <Mail className="h-4 w-4 mr-2" />
                Set Up Email Reports
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Export Summary */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="text-xs text-blue-400">
          <div className="font-semibold mb-1">Export Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-between">
              <span>Period:</span>
              <span className="font-mono">{dateRange.from} to {dateRange.to}</span>
            </div>
            <div className="flex justify-between">
              <span>Sales:</span>
              <span className="font-mono">{items.length} items</span>
            </div>
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-mono">{formatCurrency(kpis.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Profit:</span>
              <span className="font-mono">{formatCurrency(kpis.grossProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
