/**
 * Revenue Trends Chart
 * Shows sales revenue and profit over time
 */

'use client'

import { useMemo } from 'react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface RevenueChartProps {
  items: SalesItem[]
  className?: string
  view?: 'daily' | 'weekly' | 'monthly'
}

export function RevenueChart({ items, className, view = 'monthly' }: RevenueChartProps) {
  const { convert, format } = useCurrency()

  // Group sales by time period
  const chartData = useMemo(() => {
    if (items.length === 0) return []

    // Group by period
    const groups = new Map<string, { revenue: number; profit: number; count: number }>()

    items.forEach((item) => {
      if (!item.sold_date) return

      const date = new Date(item.sold_date)
      let key: string

      switch (view) {
        case 'daily':
          key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          break
        case 'weekly':
          // Get week number
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          break
        case 'monthly':
        default:
          key = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          break
      }

      const existing = groups.get(key) || { revenue: 0, profit: 0, count: 0 }
      existing.revenue += convert(item.sold_price || 0, 'GBP')
      existing.profit += convert(item.margin_gbp || 0, 'GBP')
      existing.count += 1
      groups.set(key, existing)
    })

    // Convert to array and sort
    return Array.from(groups.entries())
      .map(([period, data]) => ({
        period,
        revenue: Math.round(data.revenue),
        profit: Math.round(data.profit),
        count: data.count,
      }))
      .sort((a, b) => {
        // Simple sort by period string
        return a.period.localeCompare(b.period)
      })
      .slice(-12) // Last 12 periods
  }, [items, view, convert])

  if (chartData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[300px] bg-elev-1 rounded-xl border border-border', className)}>
        <p className="text-sm text-muted">No sales data to display</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 rounded-xl border border-border/40 p-4', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-fg uppercase tracking-wide mb-1">Revenue Trends</h3>
        <p className="text-xs text-muted">Sales revenue and profit over time</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00FF94" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00FF94" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#15251B" />
          <XAxis
            dataKey="period"
            stroke="#7FA08F"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#7FA08F"
            fontSize={11}
            tickLine={false}
            tickFormatter={(value) => `£${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0E1A15',
              border: '1px solid #15251B',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#E8F6EE', fontWeight: 600 }}
            itemStyle={{ color: '#7FA08F' }}
            formatter={(value: number) => [`£${value}`, '']}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#00FF94"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            name="Revenue"
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#3B82F6"
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
