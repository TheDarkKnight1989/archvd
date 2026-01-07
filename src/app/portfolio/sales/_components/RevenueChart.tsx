/**
 * Revenue Trends Chart
 * Shows sales revenue and profit over time
 */

'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
    <div className={cn('bg-elev-1 rounded-xl border border-border/30 p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted uppercase tracking-wide">Revenue Trends</h3>
        <div className="flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00FF94]" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            Profit
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#15251B" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#7FA08F"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#7FA08F"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `£${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0E1A15',
              border: '1px solid #15251B',
              borderRadius: '8px',
              fontSize: '11px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#E8F6EE', fontWeight: 600, marginBottom: '4px' }}
            itemStyle={{ color: '#7FA08F' }}
            formatter={(value: number) => [`£${value}`, '']}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#00FF94"
            strokeWidth={2.5}
            dot={false}
            name="Revenue"
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={false}
            name="Profit"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
