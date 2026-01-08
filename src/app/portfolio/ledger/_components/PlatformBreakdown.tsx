/**
 * Platform Breakdown Chart
 * Shows sales distribution by platform as a donut chart
 */

'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface PlatformBreakdownProps {
  items: SalesItem[]
  className?: string
}

// Platform colors
const PLATFORM_COLORS: Record<string, string> = {
  stockx: '#00FF94',
  alias: '#A855F7',
  goat: '#A855F7', // Legacy, maps to alias
  ebay: '#EF4444',
  private: '#3B82F6',
  other: '#6B7280',
}

// Normalize platform name
const normalizePlatform = (platform: string | null | undefined): string => {
  if (!platform) return 'other'
  const lower = platform.toLowerCase()
  if (lower === 'goat') return 'alias'
  return lower
}

// Get display name for platform
const getPlatformLabel = (platform: string): string => {
  const labels: Record<string, string> = {
    stockx: 'StockX',
    alias: 'Alias',
    ebay: 'eBay',
    private: 'Private',
    other: 'Other',
  }
  return labels[platform] || platform
}

export function PlatformBreakdown({ items, className }: PlatformBreakdownProps) {
  const { convert, format } = useCurrency()

  // Aggregate data by platform
  const chartData = useMemo(() => {
    const platformMap = new Map<string, { count: number; profit: number; revenue: number }>()

    items.forEach((item) => {
      const platform = normalizePlatform(item.platform)
      const existing = platformMap.get(platform) || { count: 0, profit: 0, revenue: 0 }
      existing.count += 1
      existing.profit += item.margin_gbp || 0
      existing.revenue += item.sold_price || 0
      platformMap.set(platform, existing)
    })

    return Array.from(platformMap.entries())
      .map(([platform, data]) => ({
        platform,
        label: getPlatformLabel(platform),
        count: data.count,
        profit: Math.round(data.profit),
        revenue: Math.round(data.revenue),
        color: PLATFORM_COLORS[platform] || PLATFORM_COLORS.other,
      }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  if (chartData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-[200px] bg-elev-1 rounded-xl border border-border', className)}>
        <p className="text-sm text-muted">No platform data</p>
      </div>
    )
  }

  const totalCount = chartData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className={cn('bg-elev-1 rounded-xl border border-border/30 p-4', className)}>
      <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
        By Platform
      </h3>

      <div className="flex items-center gap-4">
        {/* Donut Chart */}
        <div className="w-[120px] h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-[#0E1A15] border border-[#15251B] rounded-lg text-[11px] p-2">
                      <div className="font-semibold text-fg mb-1">{data.label}</div>
                      <div className="text-muted">
                        {data.count} sales ({Math.round((data.count / totalCount) * 100)}%)
                      </div>
                      <div
                        className="mono font-semibold mt-1"
                        style={{ color: data.profit >= 0 ? '#00FF94' : '#F87171' }}
                      >
                        {data.profit >= 0 ? '+' : ''}{format(convert(data.profit, 'GBP'))}
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {chartData.slice(0, 5).map((entry) => (
            <div key={entry.platform} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-fg">{entry.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted">{entry.count}</span>
                <span
                  className="mono font-medium w-16 text-right"
                  style={{ color: entry.profit >= 0 ? '#00FF94' : '#F87171' }}
                >
                  {entry.profit >= 0 ? '+' : ''}{format(convert(entry.profit, 'GBP'))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
