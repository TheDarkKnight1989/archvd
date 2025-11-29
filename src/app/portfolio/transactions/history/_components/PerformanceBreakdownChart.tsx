/**
 * Performance Breakdown Chart Component
 * Pie chart showing profit/spending distribution by platform
 */

'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { PieChart as PieChartIcon, Info } from 'lucide-react'
import type { TxRow } from '@/lib/transactions/types'

interface PerformanceBreakdownChartProps {
  rows: TxRow[]
  type: 'sales' | 'purchases'
  formatCurrency: (value: number) => string
  className?: string
}

const PLATFORM_COLORS: Record<string, string> = {
  'StockX': '#00FF94',
  'GOAT': '#8B5CF6',
  'eBay': '#F59E0B',
  'Alias': '#06B6D4',
  'Stadium Goods': '#EF4444',
  'Flight Club': '#10B981',
  'Other': '#6B7280',
}

export function PerformanceBreakdownChart({ rows, type, formatCurrency, className }: PerformanceBreakdownChartProps) {
  const chartData = useMemo(() => {
    if (rows.length === 0) return []

    // Group by platform
    const platformData = rows.reduce((acc, row) => {
      const platform = row.platform || 'Other'

      if (!acc[platform]) {
        acc[platform] = {
          platform,
          amount: 0,
          count: 0,
        }
      }

      if (type === 'sales' && row.realizedPL) {
        acc[platform].amount += row.realizedPL
      } else {
        acc[platform].amount += row.total
      }
      acc[platform].count += row.qty

      return acc
    }, {} as Record<string, { platform: string; amount: number; count: number }>)

    // Convert to array and add colors
    return Object.values(platformData)
      .map(item => ({
        ...item,
        name: item.platform, // Add name for legend display
        color: PLATFORM_COLORS[item.platform] || PLATFORM_COLORS['Other'],
      }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [rows, type])

  const total = chartData.reduce((sum, item) => sum + Math.abs(item.amount), 0)

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
          <PieChartIcon className="h-8 w-8 text-dim" />
        </div>
        <p className="text-fg font-medium mb-1">No data yet</p>
        <p className="text-sm text-muted">
          Platform breakdown will appear as you add transactions
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Info Tooltip */}
      <div className="group relative inline-block mb-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-elev-0 border border-border/50 rounded-lg">
          <Info className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs text-muted">
            {type === 'sales'
              ? 'Shows which platforms generated the most profit'
              : 'Shows which platforms you spent the most on for inventory'}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="amount"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 17, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px',
              backdropFilter: 'blur(8px)',
            }}
            labelStyle={{
              color: '#fff',
              fontWeight: 600,
              marginBottom: '4px',
            }}
            itemStyle={{
              color: '#a0a0a0',
              fontSize: '13px',
            }}
            formatter={(value: number) => [formatCurrency(Math.abs(value)), type === 'sales' ? 'Profit' : 'Inventory Cost']}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{
              paddingTop: '16px',
              fontSize: '13px',
            }}
            formatter={(value, entry: any) => {
              const percentage = total > 0 ? ((Math.abs(entry.payload.amount) / total) * 100).toFixed(1) : '0.0'
              return `${value} (${percentage}%)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
