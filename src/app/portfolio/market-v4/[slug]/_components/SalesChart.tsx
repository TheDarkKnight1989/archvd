'use client'

/**
 * SalesChart - V4 Sales Visualization
 *
 * Shows sales volume and average price over time.
 * Supports three views:
 * - 90D (raw sales, daily resolution)
 * - 13M (daily aggregates)
 * - All-time (monthly aggregates)
 */

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from 'recharts'
import type { SalesChartPoint } from '@/hooks/useV4SalesHistory'

interface SalesChartProps {
  data: SalesChartPoint[] | null
  loading?: boolean
  error?: Error | null
  title: string
  dateFormat?: 'day' | 'month'
  currencySymbol?: string
}

export function SalesChart({
  data,
  loading,
  error,
  title,
  dateFormat = 'day',
  currencySymbol = '$',
}: SalesChartProps) {
  // Format date for display
  const formattedData = useMemo(() => {
    if (!data) return []

    return data.map((point) => ({
      ...point,
      displayDate:
        dateFormat === 'month'
          ? formatMonth(point.date)
          : formatDay(point.date),
    }))
  }, [data, dateFormat])

  if (loading) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-red-500 text-sm">
          Error: {error.message}
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No sales data available
        </div>
      </div>
    )
  }

  // Calculate summary stats
  const totalSales = data.reduce((sum, p) => sum + p.totalSales, 0)
  const totalVolume = data.reduce((sum, p) => sum + p.volume, 0)
  const avgPrice = Math.round(totalVolume / totalSales)

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {totalSales.toLocaleString()} sales | {currencySymbol}
            {totalVolume.toLocaleString()} volume
          </div>
          <div className="font-medium text-foreground">
            Avg: {currencySymbol}
            {avgPrice}
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={formattedData}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={dateFormat === 'month' ? 0 : 'preserveStartEnd'}
              angle={dateFormat === 'month' ? -45 : 0}
              textAnchor={dateFormat === 'month' ? 'end' : 'middle'}
              height={dateFormat === 'month' ? 60 : 30}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${currencySymbol}${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as SalesChartPoint & {
                  displayDate: string
                }
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                    <div className="font-medium">{p.displayDate}</div>
                    <div className="mt-1 space-y-0.5">
                      <div>Sales: {p.totalSales}</div>
                      <div>
                        Avg: {currencySymbol}
                        {p.avgPrice}
                      </div>
                      <div className="text-muted-foreground">
                        Range: {currencySymbol}
                        {p.minPrice} - {currencySymbol}
                        {p.maxPrice}
                      </div>
                    </div>
                  </div>
                )
              }}
            />
            {/* Volume bars */}
            <Bar
              yAxisId="right"
              dataKey="totalSales"
              fill="hsl(var(--primary) / 0.2)"
              radius={[2, 2, 0, 0]}
            />
            {/* Price line */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="avgPrice"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.1)"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Format YYYY-MM-DD to "Dec 17"
function formatDay(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format YYYY-MM to "Dec '25"
function formatMonth(date: string): string {
  const [year, month] = date.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short' }) + " '" + year.slice(2)
}
