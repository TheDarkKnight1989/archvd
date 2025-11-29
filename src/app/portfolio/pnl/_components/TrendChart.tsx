/**
 * Trend Chart Component
 * Shows revenue & profit trends over time
 */

'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DataPoint {
  date: string
  revenue: number
  profit: number
  expenses: number
}

interface TrendChartProps {
  items: any[]
  formatCurrency: (value: number) => string
  className?: string
}

export function TrendChart({ items, formatCurrency, className }: TrendChartProps) {
  // Group data by week for trend visualization
  const weeklyData = useMemo(() => {
    const grouped = new Map<string, { revenue: number; profit: number; expenses: number }>()

    items.forEach((item) => {
      const saleDate = new Date(item.saleDate)
      // Get Monday of the week
      const monday = new Date(saleDate)
      const day = monday.getDay()
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1)
      monday.setDate(diff)
      const weekKey = monday.toISOString().split('T')[0]

      const existing = grouped.get(weekKey) || { revenue: 0, profit: 0, expenses: 0 }

      existing.revenue += item.salePrice || 0
      existing.profit += item.margin || 0
      existing.expenses += item.cost || 0

      grouped.set(weekKey, existing)
    })

    // Convert to array and sort by date
    return Array.from(grouped.entries())
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        profit: stats.profit,
        expenses: stats.expenses
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [items])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label)
      const formattedDate = date.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      return (
        <div className="bg-elev-2 border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-dim mb-2">Week of {formattedDate}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted">Revenue</span>
              <span className="text-xs font-bold text-accent mono">{formatCurrency(payload[0].value)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted">Profit</span>
              <span className="text-xs font-bold text-[#00FF94] mono">{formatCurrency(payload[1].value)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted">Expenses</span>
              <span className="text-xs font-bold text-red-400 mono">{formatCurrency(payload[2].value)}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (weeklyData.length === 0) {
    return (
      <div className={cn('bg-elev-1 border border-border rounded-xl p-6', className)}>
        <div className="text-center text-muted">
          <p className="text-sm">No data available for trend chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold text-fg">Revenue & Profit Trends</h3>
        <span className="text-xs text-dim ml-2">Weekly view</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--accent))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="rgb(var(--accent))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00FF94" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00FF94" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(248 113 113)" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="rgb(248 113 113)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="date"
            stroke="rgb(var(--dim))"
            style={{ fontSize: '11px' }}
            tickFormatter={(value) => {
              const date = new Date(value)
              return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
            }}
          />
          <YAxis
            stroke="rgb(var(--dim))"
            style={{ fontSize: '11px' }}
            tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="rgb(248 113 113)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorExpenses)"
            name="Expenses"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="rgb(var(--accent))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            name="Revenue"
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#00FF94"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorProfit)"
            name="Profit"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
