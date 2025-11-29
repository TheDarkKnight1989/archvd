'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'

export type Timeframe = '24h' | '1w' | '1m' | 'ytd' | 'all' | 'custom'

interface ChartDataPoint {
  date: string
  value: number | null
}

interface DashboardChartProps {
  data: ChartDataPoint[]
  timeframe: Timeframe
  onTimeframeChange: (timeframe: Timeframe) => void
  loading?: boolean
}

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '24h': '24H',
  '1w': '1W',
  '1m': '1M',
  ytd: 'YTD',
  all: 'ALL',
  custom: 'Custom',
}

function TimeframeChip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300',
        active
          ? 'bg-gradient-to-r from-accent/30 to-accent/20 text-accent border border-accent/60 shadow-[0_0_16px_rgba(196,164,132,0.4)] scale-105'
          : 'border border-neutral-700/50 text-neutral-400 hover:border-accent/40 hover:text-neutral-200 hover:bg-accent/5',
        disabled && 'opacity-40 cursor-not-allowed hover:border-neutral-700/50 hover:bg-transparent'
      )}
    >
      {label}
    </button>
  )
}

export function DashboardChart({ data, timeframe, onTimeframeChange, loading = false }: DashboardChartProps) {
  const { format, currency } = useCurrency()

  // Filter out null values for charting
  const chartData = data
    .filter((d) => d.value !== null)
    .map((d) => ({
      date: d.date,
      value: d.value as number,
    }))

  // Custom tooltip with premium styling
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-gradient-to-br from-elev-2 to-elev-1 border border-accent/40 rounded-lg px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {new Date(data.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-base font-bold text-accent mono tabular-nums">{format(data.value)}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="relative p-6 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 overflow-hidden">
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

        <div className="relative space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-32 animate-pulse" />
              <div className="h-3 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded w-48 animate-pulse" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-12 bg-gradient-to-r from-elev-1 to-elev-1/50 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
          <div className="h-64 bg-gradient-to-br from-elev-1 to-elev-1/50 rounded-lg animate-pulse" />
        </div>
      </Card>
    )
  }

  return (
    <Card className="group relative p-6 bg-gradient-to-br from-accent/5 via-elev-2 to-elev-2 border-border/40 hover:border-accent/40 transition-all duration-300 hover:shadow-[0_0_40px_rgba(196,164,132,0.1)] overflow-hidden">
      {/* Subtle gradient glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Header with Timeframe Chips */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-50 mb-1">Portfolio Value</h3>
          <p className="text-[11px] text-neutral-400">Historical performance over time</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
            <TimeframeChip
              key={tf}
              label={TIMEFRAME_LABELS[tf]}
              active={timeframe === tf}
              onClick={() => onTimeframeChange(tf)}
              disabled={tf === 'custom'} // Future: Implement custom date range picker
            />
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="relative w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(196, 164, 132)" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="rgb(196, 164, 132)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="rgb(196, 164, 132)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickLine={false}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getDate()}/${date.getMonth() + 1}`
                }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickLine={false}
                tickFormatter={(value) => {
                  // Format as K notation for cleaner axis
                  if (value >= 1000) {
                    return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${(value / 1000).toFixed(0)}k`
                  }
                  return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${value}`
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(196, 164, 132, 0.2)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgb(196, 164, 132)"
                strokeWidth={3}
                fill="url(#portfolioGradient)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: 'rgb(196, 164, 132)',
                  stroke: '#000',
                  strokeWidth: 2,
                  className: 'drop-shadow-[0_0_8px_rgba(196,164,132,0.6)]'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="relative h-64 flex flex-col items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-neutral-300 font-medium">No data available for this timeframe</p>
            <p className="text-xs text-neutral-400">Try selecting a different time range</p>
          </div>
        </div>
      )}
    </Card>
  )
}
