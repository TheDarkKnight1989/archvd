/**
 * Seasonal Trend Analysis Component
 * Year-over-year patterns by season and month
 */

'use client'

import { useMemo } from 'react'
import { Calendar, TrendingUp, Snowflake, Sun, Cloud, Leaf } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SeasonalTrendAnalysisProps {
  items: any[]
  formatCurrency: (value: number) => string
  className?: string
}

interface MonthData {
  month: string
  revenue: number
  profit: number
  itemsSold: number
  avgSalePrice: number
  season: 'Winter' | 'Spring' | 'Summer' | 'Fall'
}

interface SeasonData {
  season: string
  revenue: number
  profit: number
  itemsSold: number
  margin: number
  bestMonth: string
  worstMonth: string
}

export function SeasonalTrendAnalysis({
  items,
  formatCurrency,
  className
}: SeasonalTrendAnalysisProps) {
  // Group by month
  const monthlyData = useMemo((): MonthData[] => {
    const grouped = new Map<string, Omit<MonthData, 'season'>>()

    items.forEach((item) => {
      const date = new Date(item.saleDate || item.date)
      const monthKey = date.toLocaleString('en-GB', { month: 'long', year: 'numeric' })

      const existing = grouped.get(monthKey) || {
        month: monthKey,
        revenue: 0,
        profit: 0,
        itemsSold: 0,
        avgSalePrice: 0
      }

      existing.revenue += item.salePrice || 0
      existing.profit += item.margin || 0
      existing.itemsSold += 1

      grouped.set(monthKey, existing)
    })

    return Array.from(grouped.entries())
      .map(([_, data]) => ({
        ...data,
        avgSalePrice: data.itemsSold > 0 ? data.revenue / data.itemsSold : 0,
        season: getSeasonFromMonth(data.month)
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month)
        const dateB = new Date(b.month)
        return dateA.getTime() - dateB.getTime()
      })
  }, [items])

  // Group by season
  const seasonalData = useMemo((): SeasonData[] => {
    const seasons = new Map<string, { revenue: number; profit: number; itemsSold: number; months: MonthData[] }>()

    monthlyData.forEach((month) => {
      const existing = seasons.get(month.season) || {
        revenue: 0,
        profit: 0,
        itemsSold: 0,
        months: []
      }

      existing.revenue += month.revenue
      existing.profit += month.profit
      existing.itemsSold += month.itemsSold
      existing.months.push(month)

      seasons.set(month.season, existing)
    })

    return Array.from(seasons.entries()).map(([season, data]) => {
      const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
      const sortedMonths = [...data.months].sort((a, b) => b.revenue - a.revenue)

      return {
        season,
        revenue: data.revenue,
        profit: data.profit,
        itemsSold: data.itemsSold,
        margin,
        bestMonth: sortedMonths[0]?.month.split(' ')[0] || 'N/A',
        worstMonth: sortedMonths[sortedMonths.length - 1]?.month.split(' ')[0] || 'N/A'
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [monthlyData])

  const bestSeason = seasonalData[0]
  const worstSeason = seasonalData[seasonalData.length - 1]

  return (
    <div className={cn('space-y-4', className)}>
      {/* Seasonal Overview */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="h-5 w-5 text-accent" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Seasonal Performance</h3>
            <p className="text-sm text-muted mt-0.5">Year-over-year trends by season</p>
          </div>
        </div>

        {/* Best/Worst Season Insight */}
        {bestSeason && worstSeason && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="p-4 bg-[#00FF94]/5 border border-[#00FF94]/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-[#00FF94]" />
                <div className="text-sm font-semibold text-[#00FF94]">Best Season</div>
              </div>
              <div className="flex items-center gap-3">
                {getSeasonIcon(bestSeason.season)}
                <div>
                  <div className="text-xl font-bold text-fg">{bestSeason.season}</div>
                  <div className="text-sm text-muted">
                    {formatCurrency(bestSeason.revenue)} • {bestSeason.itemsSold} sales
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/5 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-5 w-5 text-amber-400" />
                <div className="text-sm font-semibold text-amber-400">Focus Area</div>
              </div>
              <div className="flex items-center gap-3">
                {getSeasonIcon(worstSeason.season)}
                <div>
                  <div className="text-xl font-bold text-fg">{worstSeason.season}</div>
                  <div className="text-sm text-muted">
                    {formatCurrency(worstSeason.revenue)} • Opportunity to grow
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seasonal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Winter', 'Spring', 'Summer', 'Fall'].map((season) => {
            const data = seasonalData.find(s => s.season === season)
            if (!data) return null

            return (
              <div key={season} className="p-4 bg-elev-0 rounded-lg border border-border/30">
                <div className="flex items-center gap-2 mb-3">
                  {getSeasonIcon(season)}
                  <div className="text-sm font-semibold text-fg">{season}</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-dim">Revenue</div>
                    <div className="text-lg font-bold text-accent mono">{formatCurrency(data.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-dim">Profit</div>
                    <div className={cn(
                      'text-sm font-bold mono',
                      data.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                    )}>
                      {formatCurrency(data.profit)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-dim">Items</div>
                      <div className="text-fg font-mono">{data.itemsSold}</div>
                    </div>
                    <div>
                      <div className="text-dim">Margin</div>
                      <div className="text-fg font-mono">{data.margin.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-xs text-dim">Best: {data.bestMonth}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-elev-1 border border-border rounded-xl p-5">
        <h4 className="text-sm font-semibold text-fg mb-4">Monthly Breakdown</h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {monthlyData.map((month, index) => {
            const prevMonth = monthlyData[index - 1]
            const growth = prevMonth
              ? ((month.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
              : 0

            return (
              <div
                key={month.month}
                className="p-3 bg-elev-0 rounded-lg border border-border/30 hover:border-accent/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getSeasonIcon(month.season, true)}
                    <div>
                      <div className="text-sm font-semibold text-fg">{month.month}</div>
                      <div className="text-xs text-muted">{month.itemsSold} sales</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right">
                    <div>
                      <div className="text-xs text-dim">Revenue</div>
                      <div className="text-sm font-bold text-accent mono">{formatCurrency(month.revenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-dim">Profit</div>
                      <div className={cn(
                        'text-sm font-bold mono',
                        month.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                      )}>
                        {formatCurrency(month.profit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-dim">vs Prev</div>
                      <div className={cn(
                        'text-sm font-bold mono',
                        growth >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                      )}>
                        {prevMonth ? `${growth >= 0 ? '+' : ''}${growth.toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-400 mb-2">Seasonal Insights</div>
        <ul className="text-xs text-blue-400 space-y-1 list-disc list-inside">
          {bestSeason && (
            <li>
              {bestSeason.season} is your strongest season - capitalize with increased inventory during {bestSeason.bestMonth}
            </li>
          )}
          {worstSeason && worstSeason.revenue < (bestSeason?.revenue || 0) * 0.5 && (
            <li>
              {worstSeason.season} revenue is {((1 - worstSeason.revenue / (bestSeason?.revenue || 1)) * 100).toFixed(0)}% lower - consider targeted promotions
            </li>
          )}
          <li>Plan inventory purchases 2-3 months before peak season</li>
        </ul>
      </div>
    </div>
  )
}

function getSeasonFromMonth(monthYear: string): 'Winter' | 'Spring' | 'Summer' | 'Fall' {
  const month = monthYear.split(' ')[0].toLowerCase()

  if (['december', 'january', 'february'].includes(month)) return 'Winter'
  if (['march', 'april', 'may'].includes(month)) return 'Spring'
  if (['june', 'july', 'august'].includes(month)) return 'Summer'
  return 'Fall'
}

function getSeasonIcon(season: string, small = false) {
  const size = small ? 'h-4 w-4' : 'h-6 w-6'

  switch (season) {
    case 'Winter':
      return <Snowflake className={cn(size, 'text-blue-400')} />
    case 'Spring':
      return <Leaf className={cn(size, 'text-green-400')} />
    case 'Summer':
      return <Sun className={cn(size, 'text-amber-400')} />
    case 'Fall':
      return <Leaf className={cn(size, 'text-orange-400')} />
    default:
      return <Calendar className={cn(size, 'text-dim')} />
  }
}
