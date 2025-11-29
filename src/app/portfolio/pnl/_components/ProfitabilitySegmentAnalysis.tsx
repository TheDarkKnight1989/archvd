/**
 * Profitability Segment Analysis Component
 * Deep dive into what's actually making money - by brand, size, platform, price range
 */

'use client'

import { useMemo, useState } from 'react'
import { PieChart, Filter, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Segment {
  name: string
  revenue: number
  profit: number
  margin: number
  count: number
  avgSalePrice: number
  avgProfit: number
  contribution: number // % of total profit
}

interface ProfitabilitySegmentAnalysisProps {
  items: any[]
  formatCurrency: (value: number) => string
  className?: string
}

type SegmentType = 'brand' | 'platform' | 'priceRange' | 'size' | 'purchasePlace'

export function ProfitabilitySegmentAnalysis({
  items,
  formatCurrency,
  className
}: ProfitabilitySegmentAnalysisProps) {
  const [activeSegment, setActiveSegment] = useState<SegmentType>('priceRange')

  const totalProfit = useMemo(() =>
    items.reduce((sum, item) => sum + (item.margin || 0), 0),
    [items]
  )

  const segments = useMemo(() => {
    const grouped = new Map<string, Omit<Segment, 'contribution'>>()

    items.forEach((item) => {
      let segmentKey = ''

      // Determine segment key based on active segment type
      switch (activeSegment) {
        case 'brand':
          segmentKey = item.brand || 'Unknown'
          break
        case 'platform':
          segmentKey = item.platform || 'Unknown'
          break
        case 'priceRange':
          const price = item.salePrice || 0
          if (price < 100) segmentKey = '£0-£100'
          else if (price < 200) segmentKey = '£100-£200'
          else if (price < 300) segmentKey = '£200-£300'
          else if (price < 500) segmentKey = '£300-£500'
          else segmentKey = '£500+'
          break
        case 'size':
          segmentKey = item.size_uk ? `UK ${item.size_uk}` : 'Unknown'
          break
        case 'purchasePlace':
          segmentKey = item.purchase_place || 'Unknown'
          break
      }

      const existing = grouped.get(segmentKey) || {
        name: segmentKey,
        revenue: 0,
        profit: 0,
        margin: 0,
        count: 0,
        avgSalePrice: 0,
        avgProfit: 0
      }

      existing.revenue += item.salePrice || 0
      existing.profit += item.margin || 0
      existing.count += 1

      grouped.set(segmentKey, existing)
    })

    // Calculate derived metrics and contribution
    const segmentsArray: Segment[] = Array.from(grouped.entries()).map(([_, segment]) => ({
      ...segment,
      margin: segment.revenue > 0 ? (segment.profit / segment.revenue) * 100 : 0,
      avgSalePrice: segment.count > 0 ? segment.revenue / segment.count : 0,
      avgProfit: segment.count > 0 ? segment.profit / segment.count : 0,
      contribution: totalProfit > 0 ? (segment.profit / totalProfit) * 100 : 0
    }))

    // Sort by profit descending
    return segmentsArray.sort((a, b) => b.profit - a.profit)
  }, [items, activeSegment, totalProfit])

  // Pareto analysis: What % of segments contribute 80% of profit
  const paretoThreshold = useMemo(() => {
    let cumulative = 0
    let count = 0
    for (const segment of segments) {
      cumulative += segment.contribution
      count++
      if (cumulative >= 80) break
    }
    return {
      count,
      percentage: segments.length > 0 ? (count / segments.length) * 100 : 0
    }
  }, [segments])

  // Identify profitable vs unprofitable segments
  const profitable = segments.filter(s => s.profit > 0)
  const unprofitable = segments.filter(s => s.profit <= 0)

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Profitability by Segment</h3>
            <p className="text-sm text-muted mt-0.5">Deep dive into what drives profit</p>
          </div>
        </div>
      </div>

      {/* Segment Selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(['priceRange', 'brand', 'platform', 'size', 'purchasePlace'] as SegmentType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveSegment(type)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeSegment === type
                ? 'bg-accent/20 text-fg border border-accent/40'
                : 'bg-elev-0 text-dim hover:text-fg hover:bg-elev-1 border border-border/30'
            )}
          >
            {type === 'priceRange' && 'Price Range'}
            {type === 'brand' && 'Brand'}
            {type === 'platform' && 'Platform'}
            {type === 'size' && 'Size'}
            {type === 'purchasePlace' && 'Source'}
          </button>
        ))}
      </div>

      {/* Pareto Insight */}
      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-5">
        <div className="flex items-start gap-3">
          <Filter className="h-5 w-5 text-purple-400 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-purple-400 mb-1">80/20 Analysis</div>
            <div className="text-xs text-purple-400">
              {paretoThreshold.count} segments ({paretoThreshold.percentage.toFixed(0)}% of total) contribute 80% of your profit.
              Focus your efforts here for maximum impact.
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="p-3 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Segments</div>
          <div className="text-2xl font-bold text-fg mono">{segments.length}</div>
        </div>
        <div className="p-3 bg-elev-0 rounded-lg border border-[#00FF94]/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Profitable</div>
          <div className="text-2xl font-bold text-[#00FF94] mono">{profitable.length}</div>
        </div>
        <div className="p-3 bg-elev-0 rounded-lg border border-red-400/30">
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Unprofitable</div>
          <div className="text-2xl font-bold text-red-400 mono">{unprofitable.length}</div>
        </div>
      </div>

      {/* Segments List */}
      <div className="space-y-3">
        {/* Top Profitable Segments */}
        {profitable.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-[#00FF94]" />
              <h4 className="text-sm font-semibold text-fg">Profitable Segments</h4>
            </div>
            <div className="space-y-2">
              {profitable.map((segment, index) => (
                <SegmentRow
                  key={segment.name}
                  segment={segment}
                  rank={index + 1}
                  formatCurrency={formatCurrency}
                  isProfitable
                />
              ))}
            </div>
          </div>
        )}

        {/* Unprofitable Segments */}
        {unprofitable.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <h4 className="text-sm font-semibold text-fg">Unprofitable Segments (Avoid)</h4>
            </div>
            <div className="space-y-2">
              {unprofitable.map((segment) => (
                <SegmentRow
                  key={segment.name}
                  segment={segment}
                  formatCurrency={formatCurrency}
                  isProfitable={false}
                />
              ))}
            </div>
          </div>
        )}

        {segments.length === 0 && (
          <div className="text-center py-8 text-dim text-sm">
            No data available for this segment type
          </div>
        )}
      </div>

      {/* Recommendations */}
      {segments.length > 0 && (
        <div className="mt-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="text-sm font-semibold text-blue-400 mb-2">Actionable Insights</div>
          <ul className="text-xs text-blue-400 space-y-1 list-disc list-inside">
            {paretoThreshold.count <= 3 && (
              <li>Your profit is highly concentrated. Consider diversifying to reduce risk.</li>
            )}
            {unprofitable.length > 0 && (
              <li>
                {unprofitable.length} segment{unprofitable.length > 1 ? 's are' : ' is'} losing money.
                Avoid or reprice these.
              </li>
            )}
            {profitable.length > 0 && (
              <li>
                Focus on {profitable[0]?.name} - your top performer with {profitable[0]?.contribution.toFixed(0)}% of total profit.
              </li>
            )}
            {segments.some(s => s.margin < 10) && (
              <li>Several segments have margins below 10%. Review pricing strategy.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

interface SegmentRowProps {
  segment: Segment
  rank?: number
  formatCurrency: (value: number) => string
  isProfitable: boolean
}

function SegmentRow({ segment, rank, formatCurrency, isProfitable }: SegmentRowProps) {
  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all',
      isProfitable
        ? 'bg-elev-0 border-[#00FF94]/20 hover:border-[#00FF94]/40'
        : 'bg-red-500/5 border-red-400/20'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {rank && (
            <div className={cn(
              'text-sm font-bold mono w-6 text-center',
              rank <= 3 ? 'text-[#FFD700]' : 'text-dim'
            )}>
              {rank}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-fg">{segment.name}</div>
            <div className="text-xs text-muted">{segment.count} sales</div>
          </div>
        </div>
        <div className="text-right">
          <div className={cn(
            'text-base font-bold mono',
            isProfitable ? 'text-[#00FF94]' : 'text-red-400'
          )}>
            {formatCurrency(segment.profit)}
          </div>
          <div className="text-xs text-dim">{segment.contribution.toFixed(1)}% of total</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <div className="text-dim mb-0.5">Revenue</div>
          <div className="text-fg font-mono">{formatCurrency(segment.revenue)}</div>
        </div>
        <div>
          <div className="text-dim mb-0.5">Margin</div>
          <div className={cn(
            'font-mono',
            segment.margin >= 20 ? 'text-[#00FF94]' :
            segment.margin >= 10 ? 'text-amber-400' :
            'text-red-400'
          )}>
            {segment.margin.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-dim mb-0.5">Avg Sale</div>
          <div className="text-fg font-mono">{formatCurrency(segment.avgSalePrice)}</div>
        </div>
        <div>
          <div className="text-dim mb-0.5">Avg Profit</div>
          <div className={cn(
            'font-mono',
            isProfitable ? 'text-[#00FF94]' : 'text-red-400'
          )}>
            {formatCurrency(segment.avgProfit)}
          </div>
        </div>
      </div>

      {/* Profit contribution bar */}
      <div className="mt-2 h-1.5 bg-elev-1 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            isProfitable ? 'bg-[#00FF94]' : 'bg-red-400'
          )}
          style={{ width: `${Math.min(100, segment.contribution)}%` }}
        />
      </div>
    </div>
  )
}
