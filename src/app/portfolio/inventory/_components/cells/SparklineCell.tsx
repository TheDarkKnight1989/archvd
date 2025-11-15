'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils/cn'

export interface SparklineCellProps {
  data: Array<{ date: string; price: number | null }>
  width?: number
  height?: number
  className?: string
}

/**
 * SparklineCell - 30-day price history chart
 * WHY: Visual trend indicator for market price movement
 */
export function SparklineCell({
  data,
  width = 96,
  height = 18,
  className,
}: SparklineCellProps) {
  // Filter out null values and format for Recharts
  const chartData = data
    .filter(d => d.price !== null)
    .map(d => ({ date: d.date, value: d.price }))

  // If no data, show flat placeholder
  const hasData = chartData.length > 0
  const displayData = hasData
    ? chartData
    : [
        { date: '1', value: 0 },
        { date: '2', value: 0 },
        { date: '3', value: 0 },
      ]

  // Determine trend color
  const firstValue = hasData ? (chartData[0]?.value ?? 0) : 0
  const lastValue = hasData ? (chartData[chartData.length - 1]?.value ?? 0) : 0
  const trend = lastValue >= firstValue ? 'up' : 'down'
  const color = trend === 'up' ? '#16A34A' : '#DC2626' // green-600 : red-600

  return (
    <div
      style={{ width, height }}
      className={cn('flex items-center justify-center', !hasData && 'opacity-20', className)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            animationDuration={200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function SparklineCellSkeleton({ width = 96, height = 18 }: { width?: number; height?: number }) {
  return (
    <div
      style={{ width, height }}
      className="bg-elev-2 rounded animate-pulse"
      aria-label="Loading price chart"
    />
  )
}
