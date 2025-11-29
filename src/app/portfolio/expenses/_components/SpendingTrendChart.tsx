/**
 * Spending Trend Chart Component
 * Line chart showing expense trends over time
 */

'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { type ExpenseCategory } from '@/lib/portfolio/types'

interface SpendingTrendChartProps {
  expenses: Array<{ category: ExpenseCategory; amount: number; date: string }>
  formatCurrency: (value: number) => string
  className?: string
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  shipping: '#3B82F6',
  fees: '#8B5CF6',
  ads: '#EC4899',
  supplies: '#10B981',
  subscriptions: '#06B6D4',
  misc: '#F59E0B',
}

export function SpendingTrendChart({ expenses, formatCurrency, className }: SpendingTrendChartProps) {
  const chartData = useMemo(() => {
    // Group by month and category
    const monthlyData = expenses.reduce((acc, expense) => {
      const monthKey = expense.date.slice(0, 7) // YYYY-MM
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          total: 0,
          shipping: 0,
          fees: 0,
          ads: 0,
          supplies: 0,
          subscriptions: 0,
          misc: 0,
        }
      }
      acc[monthKey][expense.category] += expense.amount
      acc[monthKey].total += expense.amount
      return acc
    }, {} as Record<string, any>)

    // Convert to array and sort by date
    const data = Object.values(monthlyData).sort((a, b) =>
      a.month.localeCompare(b.month)
    )

    // Format month labels
    return data.map((item) => ({
      ...item,
      monthLabel: new Date(item.month + '-01').toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      }),
    }))
  }, [expenses])

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
          <TrendingUp className="h-8 w-8 text-dim" />
        </div>
        <p className="text-fg font-medium mb-1">No trend data yet</p>
        <p className="text-sm text-muted">Expense trends will appear as you add more expenses</p>
      </div>
    )
  }

  return (
    <div className={className}>
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
            dataKey="total"
            stroke="#00FF94"
            strokeWidth={3}
            name="Total"
            dot={{ fill: '#00FF94', r: 5, strokeWidth: 2, stroke: 'rgba(0,0,0,0.3)' }}
            activeDot={{ r: 7, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="shipping"
            stroke={CATEGORY_COLORS.shipping}
            strokeWidth={2}
            name="Shipping"
            dot={{ fill: CATEGORY_COLORS.shipping, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="fees"
            stroke={CATEGORY_COLORS.fees}
            strokeWidth={2}
            name="Fees"
            dot={{ fill: CATEGORY_COLORS.fees, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="ads"
            stroke={CATEGORY_COLORS.ads}
            strokeWidth={2}
            name="Advertising"
            dot={{ fill: CATEGORY_COLORS.ads, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="supplies"
            stroke={CATEGORY_COLORS.supplies}
            strokeWidth={2}
            name="Supplies"
            dot={{ fill: CATEGORY_COLORS.supplies, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="subscriptions"
            stroke={CATEGORY_COLORS.subscriptions}
            strokeWidth={2}
            name="Subscriptions"
            dot={{ fill: CATEGORY_COLORS.subscriptions, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="misc"
            stroke={CATEGORY_COLORS.misc}
            strokeWidth={2}
            name="Misc"
            dot={{ fill: CATEGORY_COLORS.misc, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
