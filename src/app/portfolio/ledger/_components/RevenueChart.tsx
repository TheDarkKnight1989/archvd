/**
 * Revenue Trends Chart
 * Shows sales revenue and profit over time with view controls
 */

'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface RevenueChartProps {
  items: SalesItem[]
  className?: string
}

type ViewType = 'daily' | 'weekly' | 'monthly'

export function RevenueChart({ items, className }: RevenueChartProps) {
  const { convert, format } = useCurrency()
  const [view, setView] = useState<ViewType>('weekly')

  // Group sales by time period
  const chartData = useMemo(() => {
    if (items.length === 0) return []

    // Group by period with sortable key
    const groups = new Map<string, { sortKey: number; label: string; revenue: number; profit: number; count: number }>()

    items.forEach((item) => {
      if (!item.sold_date) return

      const date = new Date(item.sold_date)
      let sortKey: number
      let label: string

      switch (view) {
        case 'daily':
          // Sort by timestamp, show day + month
          sortKey = date.getTime()
          label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          break
        case 'weekly':
          // Get week start (Monday)
          const weekStart = new Date(date)
          const day = date.getDay()
          const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
          weekStart.setDate(diff)
          weekStart.setHours(0, 0, 0, 0)
          sortKey = weekStart.getTime()
          label = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          break
        case 'monthly':
        default:
          // Sort by year-month, show month + year
          sortKey = date.getFullYear() * 100 + date.getMonth()
          label = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          break
      }

      const key = String(sortKey)
      const existing = groups.get(key) || { sortKey, label, revenue: 0, profit: 0, count: 0 }
      existing.revenue += convert(item.sold_price || 0, 'GBP')
      existing.profit += convert(item.margin_gbp || 0, 'GBP')
      existing.count += 1
      groups.set(key, existing)
    })

    // Convert to array, sort by sortKey, and take last N periods
    const maxPeriods = view === 'daily' ? 14 : view === 'weekly' ? 12 : 12
    return Array.from(groups.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-maxPeriods)
      .map(({ label, revenue, profit, count }) => ({
        period: label,
        revenue: Math.round(revenue),
        profit: Math.round(profit),
        count,
      }))
  }, [items, view, convert])

  if (chartData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[200px] bg-elev-1 rounded-xl border border-border', className)}>
        <p className="text-sm text-muted">No sales data to display</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 rounded-xl border border-border/30 p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted uppercase tracking-wide">Revenue Trends</h3>

        <div className="flex items-center gap-3">
          {/* View Selector */}
          <div className="flex items-center gap-0.5 bg-elev-0 rounded-md p-0.5 border border-border/50">
            {(['daily', 'weekly', 'monthly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium rounded transition-all',
                  view === v
                    ? 'bg-accent text-black'
                    : 'text-muted hover:text-fg'
                )}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7FA08F]" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00FF94]" />
              Profit
            </span>
          </div>
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
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#7FA08F"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `£${value}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const revenue = payload.find(p => p.dataKey === 'revenue')?.value as number
              const profit = payload.find(p => p.dataKey === 'profit')?.value as number
              const count = payload[0]?.payload?.count
              return (
                <div className="bg-[#0E1A15] border border-[#15251B] rounded-lg text-[11px] p-3">
                  <div className="text-fg font-semibold mb-2">{label}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Revenue</span>
                      <span className="mono text-fg">£{revenue?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Profit</span>
                      <span
                        className="mono font-semibold"
                        style={{ color: profit >= 0 ? '#00FF94' : '#F87171' }}
                      >
                        {profit >= 0 ? '+' : ''}£{profit?.toLocaleString()}
                      </span>
                    </div>
                    {count && (
                      <div className="flex justify-between gap-4 pt-1 border-t border-border/50">
                        <span className="text-muted">Sales</span>
                        <span className="text-fg">{count}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#7FA08F"
            strokeWidth={2}
            dot={view === 'daily'}
            name="Revenue"
          />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#00FF94"
            strokeWidth={2.5}
            dot={view === 'daily'}
            name="Profit"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
