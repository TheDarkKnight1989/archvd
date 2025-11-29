/**
 * Benchmarking & Industry Comparison Component
 * Compare business metrics against sneaker reseller industry standards
 */

'use client'

import { useMemo } from 'react'
import { BarChart3, TrendingUp, Target, Award, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BenchmarkingAnalysisProps {
  revenue: number
  profit: number
  expenses: number
  inventoryTurnover: number
  avgHoldTime: number
  profitMargin: number
  formatCurrency: (value: number) => string
  className?: string
}

interface BenchmarkMetric {
  name: string
  value: number
  unit: 'currency' | 'percentage' | 'ratio' | 'days'
  industryAvg: number
  industryTop25: number
  status: 'excellent' | 'good' | 'average' | 'below-average' | 'poor'
  insight: string
}

export function BenchmarkingAnalysis({
  revenue,
  profit,
  expenses,
  inventoryTurnover,
  avgHoldTime,
  profitMargin,
  formatCurrency,
  className
}: BenchmarkingAnalysisProps) {
  // Industry benchmarks for sneaker reselling (based on industry data)
  const benchmarks = useMemo((): BenchmarkMetric[] => {
    const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 0
    const roi = expenses > 0 ? (profit / expenses) * 100 : 0

    return [
      {
        name: 'Profit Margin',
        value: profitMargin,
        unit: 'percentage',
        industryAvg: 15,
        industryTop25: 25,
        status: getStatus(profitMargin, 15, 25, 'higher'),
        insight: profitMargin >= 25
          ? 'Exceptional! You\'re in the top quartile of resellers.'
          : profitMargin >= 15
          ? 'Solid margins, above industry average.'
          : profitMargin >= 10
          ? 'Below average. Consider higher-margin inventory.'
          : 'Critical. Focus on reducing costs or increasing prices.'
      },
      {
        name: 'Inventory Turnover',
        value: inventoryTurnover,
        unit: 'ratio',
        industryAvg: 4,
        industryTop25: 6,
        status: getStatus(inventoryTurnover, 4, 6, 'higher'),
        insight: inventoryTurnover >= 6
          ? 'Outstanding! Your inventory moves very quickly.'
          : inventoryTurnover >= 4
          ? 'Good turnover rate, keeping capital liquid.'
          : inventoryTurnover >= 2
          ? 'Slow turnover. Consider more popular items.'
          : 'Very slow. Risk of inventory depreciation.'
      },
      {
        name: 'Average Hold Time',
        value: avgHoldTime,
        unit: 'days',
        industryAvg: 45,
        industryTop25: 30,
        status: getStatus(avgHoldTime, 45, 30, 'lower'),
        insight: avgHoldTime <= 30
          ? 'Excellent! Fast moving inventory.'
          : avgHoldTime <= 45
          ? 'Good average hold time.'
          : avgHoldTime <= 60
          ? 'Slightly slow. Monitor pricing strategy.'
          : 'Too slow. Items depreciating in value.'
      },
      {
        name: 'Operating Expense Ratio',
        value: expenseRatio,
        unit: 'percentage',
        industryAvg: 15,
        industryTop25: 10,
        status: getStatus(expenseRatio, 15, 10, 'lower'),
        insight: expenseRatio <= 10
          ? 'Exceptional efficiency! Very lean operation.'
          : expenseRatio <= 15
          ? 'Well-managed expenses.'
          : expenseRatio <= 20
          ? 'Above average expenses. Look for savings.'
          : 'High expense ratio impacting profitability.'
      },
      {
        name: 'Return on Investment',
        value: roi,
        unit: 'percentage',
        industryAvg: 30,
        industryTop25: 50,
        status: getStatus(roi, 30, 50, 'higher'),
        insight: roi >= 50
          ? 'Outstanding ROI! Your capital is working hard.'
          : roi >= 30
          ? 'Solid returns on your investment.'
          : roi >= 20
          ? 'Moderate ROI. Room for improvement.'
          : 'Low ROI. Review buying and pricing strategy.'
      }
    ]
  }, [revenue, profit, expenses, inventoryTurnover, avgHoldTime, profitMargin])

  const overallScore = useMemo(() => {
    const scores = benchmarks.map(b => {
      switch (b.status) {
        case 'excellent': return 100
        case 'good': return 75
        case 'average': return 50
        case 'below-average': return 25
        case 'poor': return 0
        default: return 50
      }
    })
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
  }, [benchmarks])

  const percentile = useMemo(() => {
    if (overallScore >= 85) return 'Top 10%'
    if (overallScore >= 70) return 'Top 25%'
    if (overallScore >= 50) return 'Top 50%'
    return 'Bottom 50%'
  }, [overallScore])

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Industry Benchmarking</h3>
            <p className="text-sm text-muted mt-0.5">Compare against sneaker reseller standards</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Overall Score</div>
          <div className={cn(
            'text-3xl font-bold mono',
            overallScore >= 75 ? 'text-[#00FF94]' : overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
          )}>
            {overallScore}
          </div>
          <div className="text-xs text-muted mt-0.5">{percentile}</div>
        </div>
      </div>

      {/* Overall Performance Badge */}
      <div className={cn(
        'p-4 rounded-lg border mb-5',
        overallScore >= 75 ? 'bg-[#00FF94]/5 border-[#00FF94]/30' :
        overallScore >= 50 ? 'bg-amber-500/5 border-amber-500/30' :
        'bg-red-500/5 border-red-500/30'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            overallScore >= 75 ? 'bg-[#00FF94]/10' :
            overallScore >= 50 ? 'bg-amber-500/10' :
            'bg-red-500/10'
          )}>
            <Award className={cn(
              'h-6 w-6',
              overallScore >= 75 ? 'text-[#00FF94]' :
              overallScore >= 50 ? 'text-amber-400' :
              'text-red-400'
            )} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-fg">
              {overallScore >= 75 ? 'Excellent Performance!' :
               overallScore >= 50 ? 'Good Performance' :
               'Room for Improvement'}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {overallScore >= 75 ? 'You\'re outperforming most resellers in the market.' :
               overallScore >= 50 ? 'You\'re performing at or above average in most areas.' :
               'Focus on the metrics below to improve your competitive position.'}
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Metrics */}
      <div className="space-y-4">
        {benchmarks.map((metric) => (
          <BenchmarkMetricRow
            key={metric.name}
            metric={metric}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#00FF94]"></div>
            <span className="text-dim">Top 25%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#00FF94]/60"></div>
            <span className="text-dim">Above Avg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-400"></div>
            <span className="text-dim">Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-400/60"></div>
            <span className="text-dim">Below Avg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-400"></div>
            <span className="text-dim">Poor</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BenchmarkMetricRowProps {
  metric: BenchmarkMetric
  formatCurrency: (value: number) => string
}

function BenchmarkMetricRow({ metric, formatCurrency }: BenchmarkMetricRowProps) {
  const formatValue = (value: number, unit: BenchmarkMetric['unit']) => {
    switch (unit) {
      case 'currency': return formatCurrency(value)
      case 'percentage': return `${value.toFixed(1)}%`
      case 'ratio': return `${value.toFixed(1)}x`
      case 'days': return `${Math.round(value)}d`
    }
  }

  const getBarWidth = (value: number, industryTop25: number, unit: BenchmarkMetric['unit']) => {
    const isLowerBetter = unit === 'days'
    const target = industryTop25
    const maxValue = target * 2

    if (isLowerBetter) {
      // For metrics where lower is better
      return Math.min(100, Math.max(0, ((maxValue - value) / maxValue) * 100))
    } else {
      // For metrics where higher is better
      return Math.min(100, (value / maxValue) * 100)
    }
  }

  const barWidth = getBarWidth(metric.value, metric.industryTop25, metric.unit)

  return (
    <div className="p-4 bg-elev-0 rounded-lg border border-border/30">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-fg">{metric.name}</div>
          <div className="text-xs text-muted mt-0.5">{metric.insight}</div>
        </div>
        <div className="text-right">
          <div className={cn(
            'text-lg font-bold mono',
            metric.status === 'excellent' && 'text-[#00FF94]',
            metric.status === 'good' && 'text-[#00FF94]/80',
            metric.status === 'average' && 'text-amber-400',
            metric.status === 'below-average' && 'text-red-400/80',
            metric.status === 'poor' && 'text-red-400'
          )}>
            {formatValue(metric.value, metric.unit)}
          </div>
          <div className="text-xs text-dim mt-0.5">
            vs {formatValue(metric.industryAvg, metric.unit)} avg
          </div>
        </div>
      </div>

      {/* Visual Bar */}
      <div className="space-y-2">
        {/* Your Performance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-dim">Your Performance</span>
            <span className={cn(
              'text-xs font-semibold',
              metric.status === 'excellent' && 'text-[#00FF94]',
              metric.status === 'good' && 'text-[#00FF94]/80',
              metric.status === 'average' && 'text-amber-400',
              metric.status === 'below-average' && 'text-red-400/80',
              metric.status === 'poor' && 'text-red-400'
            )}>
              {metric.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>
          <div className="h-2 bg-elev-1 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                metric.status === 'excellent' && 'bg-[#00FF94]',
                metric.status === 'good' && 'bg-[#00FF94]/80',
                metric.status === 'average' && 'bg-amber-400',
                metric.status === 'below-average' && 'bg-red-400/80',
                metric.status === 'poor' && 'bg-red-400'
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Benchmarks */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-accent" />
            <span className="text-dim">Industry Avg:</span>
            <span className="text-fg font-mono">{formatValue(metric.industryAvg, metric.unit)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Award className="h-3 w-3 text-[#00FF94]" />
            <span className="text-dim">Top 25%:</span>
            <span className="text-fg font-mono">{formatValue(metric.industryTop25, metric.unit)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getStatus(
  value: number,
  avgThreshold: number,
  top25Threshold: number,
  direction: 'higher' | 'lower'
): BenchmarkMetric['status'] {
  if (direction === 'higher') {
    if (value >= top25Threshold) return 'excellent'
    if (value >= avgThreshold) return 'good'
    if (value >= avgThreshold * 0.75) return 'average'
    if (value >= avgThreshold * 0.5) return 'below-average'
    return 'poor'
  } else {
    // Lower is better
    if (value <= top25Threshold) return 'excellent'
    if (value <= avgThreshold) return 'good'
    if (value <= avgThreshold * 1.25) return 'average'
    if (value <= avgThreshold * 1.5) return 'below-average'
    return 'poor'
  }
}
