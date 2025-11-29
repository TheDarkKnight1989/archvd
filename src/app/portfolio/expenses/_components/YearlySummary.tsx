/**
 * Yearly Summary Component
 * Tax year summary of expenses
 */

'use client'

import { useMemo } from 'react'
import { Calendar, TrendingUp, DollarSign, PieChart, CheckSquare } from 'lucide-react'
import { type ExpenseCategory } from '@/lib/portfolio/types'
import { cn } from '@/lib/utils/cn'

interface YearlySummaryProps {
  expenses: Array<{ category: ExpenseCategory; amount: number; date: string; is_tax_deductible?: boolean }>
  formatCurrency: (value: number) => string
  className?: string
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  shipping: 'Shipping',
  fees: 'Platform Fees',
  ads: 'Advertising',
  supplies: 'Supplies',
  subscriptions: 'Subscriptions',
  misc: 'Miscellaneous',
}

export function YearlySummary({ expenses, formatCurrency, className }: YearlySummaryProps) {
  // Calculate tax year (UK: April 6 - April 5)
  const currentTaxYear = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const taxYearStart = new Date(currentYear, 3, 6) // April 6

    if (now < taxYearStart) {
      // We're before April 6, so tax year is previous year to current year
      return {
        start: new Date(currentYear - 1, 3, 6),
        end: new Date(currentYear, 3, 5),
        label: `${currentYear - 1}/${currentYear.toString().slice(2)}`,
      }
    } else {
      // We're after April 6, so tax year is current year to next year
      return {
        start: new Date(currentYear, 3, 6),
        end: new Date(currentYear + 1, 3, 5),
        label: `${currentYear}/${(currentYear + 1).toString().slice(2)}`,
      }
    }
  }, [])

  // Filter expenses for current tax year
  const taxYearExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const expDate = new Date(exp.date)
      return expDate >= currentTaxYear.start && expDate <= currentTaxYear.end
    })
  }, [expenses, currentTaxYear])

  // Calculate totals
  const totals = useMemo(() => {
    const total = taxYearExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const taxDeductible = taxYearExpenses
      .filter((exp) => exp.is_tax_deductible)
      .reduce((sum, exp) => sum + exp.amount, 0)

    const byCategory = taxYearExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount
      return acc
    }, {} as Record<ExpenseCategory, number>)

    return {
      total,
      taxDeductible,
      byCategory,
      count: taxYearExpenses.length,
    }
  }, [taxYearExpenses])

  const topCategories = Object.entries(totals.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Card */}
      <div className="bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-6 w-6 text-accent" />
          <div>
            <h3 className="text-xl font-bold text-fg">Tax Year {currentTaxYear.label}</h3>
            <p className="text-sm text-muted">
              {currentTaxYear.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} –{' '}
              {currentTaxYear.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-elev-1/50 rounded-lg p-4 border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-fg mono">{formatCurrency(totals.total)}</div>
            <div className="text-xs text-muted mt-1">{totals.count} expenses</div>
          </div>

          <div className="bg-elev-1/50 rounded-lg p-4 border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Tax Deductible</div>
            <div className="text-2xl font-bold text-green-400 mono">{formatCurrency(totals.taxDeductible)}</div>
            <div className="text-xs text-muted mt-1">
              {totals.total > 0 ? ((totals.taxDeductible / totals.total) * 100).toFixed(1) : 0}% of total
            </div>
          </div>

          <div className="bg-elev-1/50 rounded-lg p-4 border border-border/30">
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Average/Month</div>
            <div className="text-2xl font-bold text-accent mono">
              {formatCurrency(totals.total / 12)}
            </div>
            <div className="text-xs text-muted mt-1">monthly average</div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-5 w-5 text-accent" />
          <h4 className="text-sm font-semibold text-fg">Category Breakdown (Tax Year)</h4>
        </div>

        <div className="space-y-3">
          {topCategories.map(([category, amount]) => {
            const percentage = totals.total > 0 ? (amount / totals.total) * 100 : 0
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg capitalize">{CATEGORY_LABELS[category as ExpenseCategory]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dim">{percentage.toFixed(1)}%</span>
                    <span className="text-sm font-mono font-semibold text-accent w-24 text-right">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-elev-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tax Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckSquare className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-400">
            <strong>Self Assessment Tip:</strong> These totals are calculated for the UK tax year (April 6 - April 5).
            Export your tax-deductible expenses for your accountant or Self Assessment form.
          </div>
        </div>
      </div>
    </div>
  )
}
