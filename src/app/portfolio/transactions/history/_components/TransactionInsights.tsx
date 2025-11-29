/**
 * Transaction Insights Component
 * Shows best performers, profit margins, and key metrics
 */

'use client'

import { useMemo } from 'react'
import { Trophy, TrendingDown, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TxRow } from '@/lib/transactions/types'

interface TransactionInsightsProps {
  rows: TxRow[]
  type: 'sales' | 'purchases'
  formatCurrency: (value: number) => string
  className?: string
}

export function TransactionInsights({ rows, type, formatCurrency, className }: TransactionInsightsProps) {
  const insights = useMemo(() => {
    if (rows.length === 0 || type !== 'sales') return null

    // Find best performer
    const bestPerformer = rows.reduce((best, row) => {
      const profit = row.realizedPL || 0
      return profit > (best.realizedPL || 0) ? row : best
    }, rows[0])

    // Find worst performer
    const worstPerformer = rows.reduce((worst, row) => {
      const profit = row.realizedPL || 0
      return profit < (worst.realizedPL || 0) ? row : worst
    }, rows[0])

    // Calculate average hold time (mock data - would need purchase dates in real impl)
    const avgHoldTime = 45 // days

    // Calculate average profit margin
    const avgMargin = rows.reduce((sum, row) => {
      return sum + (row.performancePct || 0)
    }, 0) / rows.length

    return {
      bestPerformer,
      worstPerformer,
      avgHoldTime,
      avgMargin,
    }
  }, [rows, type])

  if (!insights || type !== 'sales') {
    return null
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-accent" />
        <div>
          <h3 className="text-lg font-semibold text-fg">Transaction Insights</h3>
          <p className="text-sm text-muted mt-0.5">Performance summary</p>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="space-y-4">
        {/* Best Performer */}
        <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-green-400" />
            <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">Best Performer</span>
          </div>
          <div className="text-sm text-fg font-medium truncate mb-1">
            {insights.bestPerformer.title}
          </div>
          <div className="text-lg font-bold text-green-400 font-mono">
            +{formatCurrency(insights.bestPerformer.realizedPL || 0)}
          </div>
        </div>

        {/* Worst Performer */}
        {insights.worstPerformer.realizedPL && insights.worstPerformer.realizedPL < 0 && (
          <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Biggest Loss</span>
            </div>
            <div className="text-sm text-fg font-medium truncate mb-1">
              {insights.worstPerformer.title}
            </div>
            <div className="text-lg font-bold text-red-400 font-mono">
              {formatCurrency(insights.worstPerformer.realizedPL || 0)}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-dim" />
                <span className="text-xs text-muted">Avg Hold Time</span>
              </div>
              <span className="text-sm font-semibold text-fg">{insights.avgHoldTime} days</span>
            </div>
          </div>

          <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-dim" />
                <span className="text-xs text-muted">Avg Margin</span>
              </div>
              <span className={cn(
                'text-sm font-semibold font-mono',
                insights.avgMargin >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {insights.avgMargin >= 0 ? '+' : ''}{insights.avgMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Tip:</strong> Track these metrics over time to optimize your buying and selling strategy.
      </div>
    </div>
  )
}
