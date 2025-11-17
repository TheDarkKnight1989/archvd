'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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
        'px-3 py-1 rounded-full text-[11px] font-medium transition-colors',
        active
          ? 'bg-accent/25 text-accent-100 border border-accent/80 shadow-[0_0_12px_rgba(74,222,128,0.35)]'
          : 'border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100',
        disabled && 'opacity-50 cursor-not-allowed'
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-medium">
        <p className="text-xs text-dim mb-1">{new Date(data.date).toLocaleDateString('en-GB')}</p>
        <p className="text-sm font-semibold text-fg mono">{format(data.value)}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="p-6 bg-elev-2 border-border/40">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 bg-elev-1 rounded w-48 animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-12 bg-elev-1 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="h-64 bg-elev-1 rounded animate-pulse" />
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-elev-2 border-border/40">
      {/* Header with Timeframe Chips */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h3 className="text-sm font-medium text-neutral-50">Portfolio Value</h3>
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
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getDate()}/${date.getMonth() + 1}`
                }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                tickFormatter={(value) => {
                  // Format as K notation for cleaner axis
                  if (value >= 1000) {
                    return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${(value / 1000).toFixed(0)}k`
                  }
                  return `${currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}${value}`
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="rgb(196, 164, 132)" // accent color
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'rgb(196, 164, 132)', stroke: '#000', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-neutral-400">No data available for this timeframe</p>
        </div>
      )}
    </Card>
  )
}
