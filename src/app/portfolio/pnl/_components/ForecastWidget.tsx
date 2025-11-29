/**
 * Forecast Widget Component
 * AI-powered revenue and profit projections based on historical data
 */

'use client'

import { useMemo } from 'react'
import { TrendingUp, Sparkles, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ForecastWidgetProps {
  soldItems: any[]
  formatCurrency: (value: number) => string
  className?: string
}

interface ForecastPeriod {
  period: string
  revenue: number
  profit: number
  items: number
  confidence: 'high' | 'medium' | 'low'
}

export function ForecastWidget({ soldItems, formatCurrency, className }: ForecastWidgetProps) {
  const forecast = useMemo(() => {
    if (soldItems.length < 3) {
      return null // Not enough data
    }

    // Calculate weekly averages
    const weeklyRevenue = soldItems.reduce((sum, item) => sum + (item.salePrice || 0), 0) / 4
    const weeklyProfit = soldItems.reduce((sum, item) => sum + (item.margin || 0), 0) / 4
    const weeklyItems = soldItems.length / 4

    // Calculate growth rate (simple linear regression)
    const sortedItems = [...soldItems].sort((a, b) =>
      new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
    )

    const firstHalf = sortedItems.slice(0, Math.floor(sortedItems.length / 2))
    const secondHalf = sortedItems.slice(Math.floor(sortedItems.length / 2))

    const firstHalfRevenue = firstHalf.reduce((sum, item) => sum + (item.salePrice || 0), 0) / firstHalf.length
    const secondHalfRevenue = secondHalf.reduce((sum, item) => sum + (item.salePrice || 0), 0) / secondHalf.length

    const growthRate = firstHalfRevenue > 0 ? (secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue : 0

    // Apply growth rate to future periods
    const nextWeekRevenue = weeklyRevenue * (1 + growthRate)
    const nextMonthRevenue = weeklyRevenue * 4 * (1 + growthRate)
    const nextQuarterRevenue = weeklyRevenue * 13 * (1 + growthRate)

    const profitMargin = weeklyRevenue > 0 ? weeklyProfit / weeklyRevenue : 0

    const forecasts: ForecastPeriod[] = [
      {
        period: 'Next Week',
        revenue: nextWeekRevenue,
        profit: nextWeekRevenue * profitMargin,
        items: Math.round(weeklyItems * (1 + growthRate)),
        confidence: soldItems.length >= 20 ? 'high' : soldItems.length >= 10 ? 'medium' : 'low'
      },
      {
        period: 'Next Month',
        revenue: nextMonthRevenue,
        profit: nextMonthRevenue * profitMargin,
        items: Math.round(weeklyItems * 4 * (1 + growthRate)),
        confidence: soldItems.length >= 20 ? 'medium' : 'low'
      },
      {
        period: 'Next Quarter',
        revenue: nextQuarterRevenue,
        profit: nextQuarterRevenue * profitMargin,
        items: Math.round(weeklyItems * 13 * (1 + growthRate)),
        confidence: soldItems.length >= 30 ? 'medium' : 'low'
      }
    ]

    return {
      forecasts,
      growthRate,
      confidence: soldItems.length >= 20 ? 'high' : soldItems.length >= 10 ? 'medium' : 'low'
    }
  }, [soldItems])

  if (!forecast) {
    return (
      <div className={cn('bg-elev-1 border border-border rounded-xl p-6', className)}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-accent/10 mb-3">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <h3 className="text-base font-semibold text-fg mb-1">Not Enough Data</h3>
          <p className="text-sm text-muted">
            Need at least 3 sales to generate forecasts
          </p>
        </div>
      </div>
    )
  }

  const { forecasts, growthRate } = forecast

  return (
    <div className={cn('bg-elev-1 border border-purple-500/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-fg">AI Forecast & Projections</h3>
            <p className="text-sm text-muted mt-0.5">Based on {soldItems.length} sales</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide mb-0.5">Growth Rate</div>
          <div className={cn(
            'text-base font-bold mono',
            growthRate >= 0 ? 'text-[#00FF94]' : 'text-red-400'
          )}>
            {growthRate >= 0 ? '+' : ''}{(growthRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Forecasts */}
      <div className="space-y-3">
        {forecasts.map((f, index) => (
          <div
            key={f.period}
            className="p-3 bg-elev-0 rounded-lg border border-purple-500/20"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-fg">{f.period}</span>
              </div>
              <div className={cn(
                'text-xs px-2 py-0.5 rounded-full font-semibold uppercase',
                f.confidence === 'high' && 'bg-[#00FF94]/10 text-[#00FF94]',
                f.confidence === 'medium' && 'bg-amber-400/10 text-amber-400',
                f.confidence === 'low' && 'bg-red-400/10 text-red-400'
              )}>
                {f.confidence} confidence
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-dim mb-0.5">Revenue</div>
                <div className="text-sm font-bold text-accent mono">{formatCurrency(f.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-dim mb-0.5">Profit</div>
                <div className="text-sm font-bold text-[#00FF94] mono">{formatCurrency(f.profit)}</div>
              </div>
              <div>
                <div className="text-xs text-dim mb-0.5">Items</div>
                <div className="text-sm font-bold text-fg mono">{f.items}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-400">
        <strong>Note:</strong> Forecasts are based on historical trends and may not reflect future market conditions.
      </div>
    </div>
  )
}
