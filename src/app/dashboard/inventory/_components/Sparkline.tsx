'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

export interface SparklineProps {
  data: { date: string; value: number }[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({
  data,
  width = 80,
  height = 32,
  color = 'hsl(var(--accent))',
}: SparklineProps) {
  // If no data, show flat placeholder line
  const chartData = data.length > 0 ? data : [
    { date: '1', value: 0 },
    { date: '2', value: 0 },
    { date: '3', value: 0 },
  ]

  const isEmpty = data.length === 0

  return (
    <div style={{ width, height }} className={isEmpty ? 'opacity-30' : ''}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            fill="url(#sparklineGradient)"
            animationDuration={200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SparklineSkeleton({ width = 80, height = 32 }: { width?: number; height?: number }) {
  return (
    <div
      style={{ width, height }}
      className="bg-elev-2 rounded animate-pulse"
      aria-label="Loading price chart"
    />
  )
}
