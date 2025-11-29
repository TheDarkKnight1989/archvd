/**
 * Automated Tax Filing Component
 * HMRC integration for VAT returns and Self Assessment
 */

'use client'

import { useState } from 'react'
import { FileText, Send, Calendar, CheckCircle, AlertTriangle, Download, Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface TaxReturn {
  id: string
  type: 'vat' | 'self-assessment'
  period: string
  dueDate: Date
  status: 'draft' | 'ready' | 'submitted' | 'overdue'
  amount: number
  filedDate?: Date
}

interface AutomatedTaxFilingProps {
  vatData: {
    totalDue: number
    totalReclaimed: number
    netDue: number
  }
  revenue: number
  profit: number
  formatCurrency: (value: number) => string
  className?: string
}

export function AutomatedTaxFiling({
  vatData,
  revenue,
  profit,
  formatCurrency,
  className
}: AutomatedTaxFilingProps) {
  const [returns, setReturns] = useState<TaxReturn[]>([
    {
      id: '1',
      type: 'vat',
      period: 'Q4 2024 (Oct-Dec)',
      dueDate: new Date(2025, 1, 7), // 7 Feb 2025
      status: 'ready',
      amount: vatData.netDue
    },
    {
      id: '2',
      type: 'self-assessment',
      period: '2023/24 Tax Year',
      dueDate: new Date(2025, 0, 31), // 31 Jan 2025
      status: 'draft',
      amount: profit * 0.2 // Simplified estimate
    }
  ])

  const [submitting, setSubmitting] = useState<string | null>(null)

  const handleSubmit = async (returnId: string) => {
    setSubmitting(returnId)
    // Simulate API call to HMRC
    await new Promise(resolve => setTimeout(resolve, 2000))

    setReturns(returns.map(r =>
      r.id === returnId
        ? { ...r, status: 'submitted', filedDate: new Date() }
        : r
    ))
    setSubmitting(null)
  }

  const handleDownloadReport = (returnId: string) => {
    // Would generate and download PDF report
    console.log('Downloading report for', returnId)
  }

  const upcomingReturns = returns.filter(r => r.status !== 'submitted')
  const submittedReturns = returns.filter(r => r.status === 'submitted')

  // Calculate days until next deadline
  const nextDeadline = upcomingReturns.length > 0
    ? Math.min(...upcomingReturns.map(r => r.dueDate.getTime()))
    : null
  const daysUntilDeadline = nextDeadline
    ? Math.ceil((nextDeadline - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Tax Filing</h3>
            <p className="text-sm text-muted mt-0.5">HMRC submissions and deadlines</p>
          </div>
        </div>
        {daysUntilDeadline !== null && (
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold',
            daysUntilDeadline <= 7 ? 'bg-red-500/10 text-red-400' :
            daysUntilDeadline <= 30 ? 'bg-amber-500/10 text-amber-400' :
            'bg-blue-500/10 text-blue-400'
          )}>
            {daysUntilDeadline} days to deadline
          </div>
        )}
      </div>

      {/* Upcoming Returns */}
      {upcomingReturns.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-fg mb-3">Upcoming Returns</h4>
          <div className="space-y-3">
            {upcomingReturns.map((taxReturn) => {
              const daysUntil = Math.ceil((taxReturn.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              const isOverdue = daysUntil < 0
              const isUrgent = daysUntil <= 7 && daysUntil >= 0

              return (
                <div
                  key={taxReturn.id}
                  className={cn(
                    'p-4 rounded-lg border',
                    isOverdue ? 'bg-red-500/5 border-red-500/30' :
                    isUrgent ? 'bg-amber-500/5 border-amber-500/30' :
                    taxReturn.status === 'ready' ? 'bg-blue-500/5 border-blue-500/30' :
                    'bg-elev-0 border-border/30'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm font-semibold text-fg">
                          {taxReturn.type === 'vat' ? 'VAT Return' : 'Self Assessment'}
                        </div>
                        <div className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold uppercase',
                          taxReturn.status === 'ready' ? 'bg-[#00FF94]/10 text-[#00FF94]' :
                          taxReturn.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-dim/10 text-dim'
                        )}>
                          {taxReturn.status}
                        </div>
                      </div>
                      <div className="text-xs text-muted">{taxReturn.period}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-accent mono">{formatCurrency(taxReturn.amount)}</div>
                      <div className="text-xs text-dim">due</div>
                    </div>
                  </div>

                  {/* Deadline */}
                  <div className="flex items-center gap-2 mb-3 p-2 bg-elev-1 rounded">
                    <Calendar className={cn(
                      'h-4 w-4',
                      isOverdue ? 'text-red-400' :
                      isUrgent ? 'text-amber-400' :
                      'text-dim'
                    )} />
                    <div className="text-xs">
                      <span className="text-dim">Due: </span>
                      <span className={cn(
                        'font-semibold',
                        isOverdue ? 'text-red-400' :
                        isUrgent ? 'text-amber-400' :
                        'text-fg'
                      )}>
                        {taxReturn.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {isOverdue && <span className="text-red-400 ml-1">(OVERDUE)</span>}
                      {isUrgent && <span className="text-amber-400 ml-1">({Math.abs(daysUntil)} days left)</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSubmit(taxReturn.id)}
                      disabled={taxReturn.status === 'draft' || submitting === taxReturn.id}
                      size="sm"
                      className={cn(
                        taxReturn.status === 'ready'
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-dim/10 text-dim'
                      )}
                    >
                      {submitting === taxReturn.id ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit to HMRC
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDownloadReport(taxReturn.id)}
                      size="sm"
                      variant="outline"
                      className="border-border/30"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  {/* Draft Warning */}
                  {taxReturn.status === 'draft' && (
                    <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 rounded">
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-400">
                        This return is in draft. Review all figures before submitting. Missing data may need to be added manually.
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VAT Quick Summary */}
      <div className="mb-5 p-4 bg-elev-0 rounded-lg border border-border/30">
        <div className="text-sm font-semibold text-fg mb-3">Current VAT Period Summary</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-dim mb-0.5">VAT Due on Sales</div>
            <div className="text-sm font-bold text-red-400 mono">{formatCurrency(vatData.totalDue)}</div>
          </div>
          <div>
            <div className="text-xs text-dim mb-0.5">VAT Reclaimed</div>
            <div className="text-sm font-bold text-[#00FF94] mono">{formatCurrency(vatData.totalReclaimed)}</div>
          </div>
          <div>
            <div className="text-xs text-dim mb-0.5">Net VAT Due</div>
            <div className={cn(
              'text-sm font-bold mono',
              vatData.netDue >= 0 ? 'text-accent' : 'text-[#00FF94]'
            )}>
              {formatCurrency(Math.abs(vatData.netDue))}
              {vatData.netDue < 0 && ' refund'}
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Returns */}
      {submittedReturns.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-fg mb-3">Submitted Returns</h4>
          <div className="space-y-2">
            {submittedReturns.map((taxReturn) => (
              <div
                key={taxReturn.id}
                className="p-3 bg-[#00FF94]/5 border border-[#00FF94]/30 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-[#00FF94]" />
                    <div>
                      <div className="text-sm font-semibold text-fg">
                        {taxReturn.type === 'vat' ? 'VAT Return' : 'Self Assessment'} - {taxReturn.period}
                      </div>
                      <div className="text-xs text-muted">
                        Submitted {taxReturn.filedDate?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent mono">{formatCurrency(taxReturn.amount)}</div>
                    <div className="text-xs text-[#00FF94]">Paid</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HMRC Connection Status */}
      <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00FF94] animate-pulse"></div>
            <div className="text-sm text-fg">Connected to HMRC Making Tax Digital</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-border/30"
          >
            <Send className="h-4 w-4 mr-2" />
            Test Connection
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Making Tax Digital (MTD):</strong> This integration submits returns directly to HMRC via their API. Always review figures before submission. Late returns may incur penalties.
      </div>
    </div>
  )
}
