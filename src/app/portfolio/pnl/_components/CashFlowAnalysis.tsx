/**
 * Cash Flow Analysis Component
 * Track actual cash in/out movements with timing analysis
 */

'use client'

import { useMemo } from 'react'
import { ArrowDownCircle, ArrowUpCircle, DollarSign, Calendar, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CashFlowAnalysisProps {
  items: any[]
  expenses: any[]
  formatCurrency: (value: number) => string
  className?: string
}

interface CashFlowPeriod {
  period: string
  cashIn: number
  cashOut: number
  netCashFlow: number
  itemCount: number
}

export function CashFlowAnalysis({
  items,
  expenses,
  formatCurrency,
  className
}: CashFlowAnalysisProps) {
  // Calculate cash flow metrics
  const cashFlowData = useMemo(() => {
    // Total cash in (from sales)
    const totalCashIn = items.reduce((sum, item) => sum + (item.salePrice || 0), 0)

    // Total cash out (purchases + expenses)
    const totalPurchases = items.reduce((sum, item) => sum + (item.buyPrice || 0), 0)
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
    const totalCashOut = totalPurchases + totalExpenses

    // Net cash flow
    const netCashFlow = totalCashIn - totalCashOut

    // Operating cash flow (sales - expenses, excluding COGS)
    const operatingCashFlow = totalCashIn - totalExpenses

    // Cash conversion cycle (average days to convert inventory to cash)
    const avgDaysToSell = items.length > 0 ? calculateAvgDaysToSell(items) : 0

    return {
      totalCashIn,
      totalCashOut,
      netCashFlow,
      operatingCashFlow,
      totalPurchases,
      totalExpenses,
      avgDaysToSell,
      cashInCount: items.length,
      cashOutCount: items.length + expenses.length
    }
  }, [items, expenses])

  // Weekly breakdown
  const weeklyBreakdown = useMemo(() => {
    const weeks = new Map<string, { cashIn: number; cashOut: number; itemCount: number }>()

    // Process sales (cash in)
    items.forEach(item => {
      const saleDate = new Date(item.saleDate || item.date)
      const weekKey = getWeekKey(saleDate)

      const existing = weeks.get(weekKey) || { cashIn: 0, cashOut: 0, itemCount: 0 }
      existing.cashIn += item.salePrice || 0
      existing.cashOut += item.buyPrice || 0
      existing.itemCount += 1
      weeks.set(weekKey, existing)
    })

    // Process expenses (cash out)
    expenses.forEach(exp => {
      const expDate = new Date(exp.date)
      const weekKey = getWeekKey(expDate)

      const existing = weeks.get(weekKey) || { cashIn: 0, cashOut: 0, itemCount: 0 }
      existing.cashOut += exp.amount || 0
      weeks.set(weekKey, existing)
    })

    return Array.from(weeks.entries())
      .map(([period, data]) => ({
        period,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        netCashFlow: data.cashIn - data.cashOut,
        itemCount: data.itemCount
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }, [items, expenses])

  const { totalCashIn, totalCashOut, netCashFlow, operatingCashFlow, avgDaysToSell } = cashFlowData

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cash In */}
        <div className="bg-elev-1 border border-[#00FF94]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-[#00FF94]/10 rounded-lg">
              <ArrowUpCircle className="h-5 w-5 text-[#00FF94]" />
            </div>
            <div>
              <div className="text-xs text-dim uppercase tracking-wide">Cash In</div>
              <div className="text-xs text-muted">{cashFlowData.cashInCount} transactions</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-[#00FF94] mono">{formatCurrency(totalCashIn)}</div>
        </div>

        {/* Cash Out */}
        <div className="bg-elev-1 border border-red-400/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ArrowDownCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="text-xs text-dim uppercase tracking-wide">Cash Out</div>
              <div className="text-xs text-muted">{cashFlowData.cashOutCount} transactions</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-red-400 mono">{formatCurrency(totalCashOut)}</div>
        </div>

        {/* Net Cash Flow */}
        <div className={cn(
          'bg-elev-1 border rounded-xl p-4',
          netCashFlow >= 0 ? 'border-[#00FF94]/20' : 'border-red-400/20'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              'p-2 rounded-lg',
              netCashFlow >= 0 ? 'bg-[#00FF94]/10' : 'bg-red-500/10'
            )}>
              <DollarSign className={cn(
                'h-5 w-5',
                netCashFlow >= 0 ? 'text-[#00FF94]' : 'text-red-400'
              )} />
            </div>
            <div>
              <div className="text-xs text-dim uppercase tracking-wide">Net Cash Flow</div>
              <div className="text-xs text-muted">
                {netCashFlow >= 0 ? 'Positive' : 'Negative'}
              </div>
            </div>
          </div>
          <div className={cn(
            'text-2xl font-bold mono',
            netCashFlow >= 0 ? 'text-[#00FF94]' : 'text-red-400'
          )}>
            {formatCurrency(netCashFlow)}
          </div>
        </div>
      </div>

      {/* Cash Flow Metrics */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-fg">Cash Flow Metrics</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Operating Cash Flow */}
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Operating CF</div>
            <div className={cn(
              'text-lg font-bold mono',
              operatingCashFlow >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {formatCurrency(operatingCashFlow)}
            </div>
            <div className="text-xs text-muted mt-0.5">Revenue - Expenses</div>
          </div>

          {/* Cash Conversion Cycle */}
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Cash Cycle</div>
            <div className="text-lg font-bold text-accent mono">{Math.round(avgDaysToSell)}d</div>
            <div className="text-xs text-muted mt-0.5">Avg days to sell</div>
          </div>

          {/* Cash Flow Margin */}
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">CF Margin</div>
            <div className={cn(
              'text-lg font-bold mono',
              totalCashIn > 0 && (netCashFlow / totalCashIn) * 100 >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {totalCashIn > 0 ? ((netCashFlow / totalCashIn) * 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-xs text-muted mt-0.5">Net CF / Revenue</div>
          </div>

          {/* Expense Ratio */}
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Expense Ratio</div>
            <div className="text-lg font-bold text-fg mono">
              {totalCashIn > 0 ? ((cashFlowData.totalExpenses / totalCashIn) * 100).toFixed(1) : '0.0'}%
            </div>
            <div className="text-xs text-muted mt-0.5">Expenses / Revenue</div>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      {weeklyBreakdown.length > 0 && (
        <div className="bg-elev-1 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-fg">Weekly Cash Flow</h3>
          </div>

          <div className="space-y-2">
            {weeklyBreakdown.slice(-8).map((week) => {
              const date = new Date(week.period)
              const weekLabel = date.toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric'
              })

              return (
                <div key={week.period} className="p-3 bg-elev-0 rounded-lg border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-fg">Week of {weekLabel}</div>
                    <div className="text-xs text-dim">{week.itemCount} sales</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-dim mb-0.5">In</div>
                      <div className="text-sm font-bold text-[#00FF94] mono">
                        +{formatCurrency(week.cashIn)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-dim mb-0.5">Out</div>
                      <div className="text-sm font-bold text-red-400 mono">
                        -{formatCurrency(week.cashOut)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-dim mb-0.5">Net</div>
                      <div className={cn(
                        'text-sm font-bold mono',
                        week.netCashFlow >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                      )}>
                        {week.netCashFlow >= 0 ? '+' : ''}{formatCurrency(week.netCashFlow)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function getWeekKey(date: Date): string {
  const monday = new Date(date)
  const day = monday.getDay()
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

function calculateAvgDaysToSell(items: any[]): number {
  const daysToSell = items
    .filter(item => item.purchase_date && item.saleDate)
    .map(item => {
      const purchase = new Date(item.purchase_date)
      const sale = new Date(item.saleDate)
      return Math.floor((sale.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24))
    })
    .filter(days => days >= 0)

  if (daysToSell.length === 0) return 0
  return daysToSell.reduce((sum, days) => sum + days, 0) / daysToSell.length
}
