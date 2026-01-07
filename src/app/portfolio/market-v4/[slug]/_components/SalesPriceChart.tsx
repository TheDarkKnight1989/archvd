'use client'

/**
 * SalesPriceChart - Professional sales visualization
 *
 * Dark background, area chart for price, bars for volume
 * Labels clearly indicate this is "Actual Sales Price"
 */

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from 'recharts'
import type { ChartPoint, TimeRange } from '@/hooks/useMarketPageData'

interface SalesPriceChartProps {
  data: ChartPoint[] | null
  range: TimeRange
  loading?: boolean
  currencySymbol?: string
}

export function SalesPriceChart({
  data,
  range,
  loading,
  currencySymbol = '$',
}: SalesPriceChartProps) {
  // Format date for display
  const formattedData = useMemo(() => {
    if (!data) return []

    return data.map((point) => ({
      ...point,
      displayDate: range === 'ALL' || range === '13M'
        ? formatMonth(point.date)
        : formatDay(point.date),
    }))
  }, [data, range])

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-xs text-zinc-500 mb-3">Actual Sales Price</div>
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="text-xs text-zinc-500 mb-3">Actual Sales Price</div>
        <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
          No sales data for this period
        </div>
      </div>
    )
  }

  // Calculate min/max for Y axis with padding
  const prices = data.map((p) => p.avgPrice)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = (maxPrice - minPrice) * 0.1 || 10
  const yMin = Math.max(0, Math.floor((minPrice - padding) / 10) * 10)
  const yMax = Math.ceil((maxPrice + padding) / 10) * 10

  return (
    <div className="bg-zinc-900 rounded-xl p-4">
      <div className="text-xs text-zinc-500 mb-3">Actual Sales Price</div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={formattedData}
            margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
          >
            {/* Y axis for price */}
            <YAxis
              yAxisId="price"
              domain={[yMin, yMax]}
              tick={{ fill: '#71717a', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${currencySymbol}${v}`}
              width={45}
            />

            {/* Y axis for volume (hidden) */}
            <YAxis
              yAxisId="volume"
              orientation="right"
              hide
            />

            {/* X axis */}
            <XAxis
              dataKey="displayDate"
              tick={{ fill: '#71717a', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            {/* Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as ChartPoint & { displayDate: string }
                return (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg p-2.5 text-xs">
                    <div className="font-medium text-white">{p.displayDate}</div>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400">Avg</span>
                        <span className="text-white font-mono">
                          {currencySymbol}{p.avgPrice}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400">Range</span>
                        <span className="text-zinc-300 font-mono">
                          {currencySymbol}{p.minPrice} - {currencySymbol}{p.maxPrice}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400">Sales</span>
                        <span className="text-zinc-300 font-mono">{p.volume}</span>
                      </div>
                    </div>
                  </div>
                )
              }}
            />

            {/* Volume bars (background) */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#3f3f46"
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />

            {/* Price area */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="avgPrice"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#22c55e',
                stroke: '#18181b',
                strokeWidth: 2,
              }}
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function formatDay(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonth(date: string): string {
  const parts = date.split('-')
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short' }) + " '" + parts[0].slice(2)
}
