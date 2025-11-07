'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { gbp0 } from '@/lib/utils/format'

interface ChartDataPoint {
  date: string
  value: number
}

interface PortfolioChartProps {
  series: ChartDataPoint[]
  loading?: boolean
  onRangeChange?: (days: number) => void
  currentRange?: number
}

type RangePeriod = '7d' | '30d' | '90d' | '1y'

const rangeToDays: Record<RangePeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

const daysToRange: Record<number, RangePeriod> = {
  7: '7d',
  30: '30d',
  90: '90d',
  365: '1y',
}

export function PortfolioChart({ series, loading, onRangeChange, currentRange = 30 }: PortfolioChartProps) {
  const [range, setRange] = useState<RangePeriod>(daysToRange[currentRange] || '30d')

  const handleRangeChange = (period: RangePeriod) => {
    setRange(period)
    onRangeChange?.(rangeToDays[period])
  }

  if (loading) {
    return (
      <Card className="p-3 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[220px] md:h-[300px] w-full mt-2" />
      </Card>
    )
  }

  // Empty state
  if (!series || series.length === 0) {
    return (
      <Card className="p-3 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm text-muted font-medium">Portfolio ({range})</h3>
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y'] as RangePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => handleRangeChange(period)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors duration-fast ${
                  range === period
                    ? 'bg-surface2 text-fg'
                    : 'bg-transparent text-muted hover:text-fg hover:bg-surface'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[220px] md:h-[300px] flex items-center justify-center">
          <div className="text-center text-dim">
            <p className="text-sm">No data available</p>
            <p className="text-xs mt-1">Add items to see portfolio chart</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-3 md:p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-muted font-medium">Portfolio ({range})</h3>
        <div className="flex gap-1">
          {(['7d', '30d', '90d', '1y'] as RangePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => handleRangeChange(period)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors duration-fast ${
                range === period
                  ? 'bg-surface2 text-fg'
                  : 'bg-transparent text-muted hover:text-fg hover:bg-surface'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[220px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="archvdArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--archvd-series-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--archvd-series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--archvd-border)"
              strokeOpacity={0.6}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--archvd-fg-dim)', fontSize: 11, fontFamily: 'var(--font-jetmono)' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: 'var(--archvd-fg-dim)', fontSize: 11, fontFamily: 'var(--font-jetmono)' }}
              tickFormatter={(value) => gbp0.format(value)}
            />
            <Tooltip
              cursor={{ stroke: 'var(--archvd-accent-400)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: 'var(--archvd-bg-elev-2)',
                border: '1px solid var(--archvd-border)',
                borderRadius: 12,
                padding: '8px 12px'
              }}
              labelStyle={{ fontFamily: 'var(--font-jetmono)', fontSize: 11, color: 'var(--archvd-fg-muted)' }}
              itemStyle={{ fontFamily: 'var(--font-jetmono)', fontSize: 13, color: 'var(--archvd-fg)' }}
              formatter={(value: number) => [gbp0.format(value), 'Value']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--archvd-series-1)"
              strokeWidth={2}
              fill="url(#archvdArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
