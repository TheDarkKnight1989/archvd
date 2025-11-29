/**
 * Transaction Trends Chart Component
 * Line chart showing transaction volume and value trends over time
 */

'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Info } from 'lucide-react'
import type { TxRow } from '@/lib/transactions/types'

interface TransactionTrendsChartProps {
  rows: TxRow[]
  type: 'sales' | 'purchases'
  formatCurrency: (value: number) => string
  className?: string
}

export function TransactionTrendsChart({ rows, type, formatCurrency, className }: TransactionTrendsChartProps) {
  const chartData = useMemo(() => {
    if (rows.length === 0) return []

    // Group transactions by month
    const monthlyData = rows.reduce((acc, row) => {
      const date = new Date(row.occurredAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          value: 0,
          count: 0,
          profit: 0,
        }
      }

      acc[monthKey].value += row.total
      acc[monthKey].count += row.qty
      if (type === 'sales' && row.realizedPL) {
        acc[monthKey].profit += row.realizedPL
      }

      return acc
    }, {} as Record<string, { month: string; value: number; count: number; profit: number }>)

    // Convert to array and sort by month
    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
      .map(item => ({
        ...item,
        monthLabel: new Date(item.month + '-01').toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        }),
      }))
  }, [rows, type])

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
          <TrendingUp className="h-8 w-8 text-dim" />
        </div>
        <p className="text-fg font-medium mb-1">No trend data yet</p>
        <p className="text-sm text-muted">
          {type === 'sales' ? 'Sales' : 'Purchase'} trends will appear as you add more transactions
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
              ? 'Track your sales revenue, profit, and volume over time'
              : 'Track your purchase spending and item count over time'}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="monthLabel"
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: '12px', fontFamily: 'inherit' }}
            tick={{ fill: 'rgba(255,255,255,0.5)' }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            style={{ fontSize: '12px', fontFamily: 'inherit' }}
            tick={{ fill: 'rgba(255,255,255,0.5)' }}
            tickFormatter={(value) => formatCurrency(value).replace(/\.00$/, '')}
            width={80}
          />
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
              marginBottom: '8px',
            }}
            itemStyle={{
              fontSize: '13px',
              padding: '2px 0',
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '16px',
              fontSize: '12px',
            }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#00FF94"
            strokeWidth={3}
            name={type === 'sales' ? 'Revenue' : 'Spent'}
            dot={{ fill: '#00FF94', r: 5, strokeWidth: 2, stroke: 'rgba(0,0,0,0.3)' }}
            activeDot={{ r: 7, strokeWidth: 0 }}
            animationDuration={800}
          />
          {type === 'sales' && (
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#10B981"
              strokeWidth={2}
              name="Profit"
              dot={{ fill: '#10B981', r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={800}
            />
          )}
          <Line
            type="monotone"
            dataKey="count"
            stroke="#8B5CF6"
            strokeWidth={2}
            name="Items"
            dot={{ fill: '#8B5CF6', r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
            yAxisId="right"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="rgba(139,92,246,0.3)"
            style={{ fontSize: '12px', fontFamily: 'inherit' }}
            tick={{ fill: 'rgba(139,92,246,0.5)' }}
            width={50}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
