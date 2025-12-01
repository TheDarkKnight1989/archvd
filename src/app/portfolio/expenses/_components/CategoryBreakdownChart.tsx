/**
 * Category Breakdown Chart Component
 * Pie/Donut chart showing expense distribution by category
 */

'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import { type ExpenseCategory } from '@/lib/portfolio/types'

interface CategoryBreakdownChartProps {
  expenses: Array<{ category: ExpenseCategory; amount: number }>
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

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  shipping: 'Shipping',
  fees: 'Fees',
  ads: 'Advertising',
  supplies: 'Supplies',
  subscriptions: 'Subscriptions',
  misc: 'Miscellaneous',
}

export function CategoryBreakdownChart({ expenses, formatCurrency, className }: CategoryBreakdownChartProps) {
  const chartData = useMemo(() => {
    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
      return acc
    }, {} as Record<ExpenseCategory, number>)

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category: CATEGORY_LABELS[category as ExpenseCategory],
        amount,
        color: CATEGORY_COLORS[category as ExpenseCategory],
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const total = chartData.reduce((sum, item) => sum + item.amount, 0)

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-elev-2 flex items-center justify-center mb-3">
          <PieChartIcon className="h-8 w-8 text-dim" />
        </div>
        <p className="text-fg font-medium mb-1">No expenses yet</p>
        <p className="text-sm text-muted">Add your first expense to see category breakdown</p>
      </div>
    )
  }

  return (
    <div className={className}>
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
            label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`}
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
            formatter={(value: number) => [formatCurrency(value), 'Expense']}
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
              const percentage = ((entry.payload.amount / total) * 100).toFixed(1)
              return `${value} (${percentage}%)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Breakdown List */}
      <div className="mt-4 space-y-2">
        {chartData.map((item) => {
          const percentage = ((item.amount / total) * 100).toFixed(1)
          return (
            <div key={item.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-fg">{item.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-dim">{percentage}%</span>
                <span className="text-fg font-mono font-semibold w-20 text-right">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
