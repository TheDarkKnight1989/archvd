'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Info, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'

interface PortfolioOverviewProps {
  onOpenQuickAdd?: () => void
}

interface KPIs {
  estimatedValue: number
  invested: number
  unrealisedPL: number
  unrealisedPLDelta7d: number | null
  roi: number
  missingPricesCount: number
}

interface CategoryBreakdown {
  category: string
  value: number
  percentage: number
}

interface MissingItem {
  id: string
  sku: string
  size_uk: string | null
}

interface OverviewData {
  isEmpty: boolean
  kpis: KPIs
  series30d: { date: string; value: number | null }[]
  categoryBreakdown: CategoryBreakdown[]
  missingItems: MissingItem[]
  meta: {
    pricesAsOf: string
  }
}

export function PortfolioOverview({ onOpenQuickAdd }: PortfolioOverviewProps) {
  const { currency, format } = useCurrency()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMissingPanel, setShowMissingPanel] = useState(false)

  useEffect(() => {
    fetchOverview()
  }, [currency])

  const fetchOverview = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/portfolio/overview?currency=${currency}`)
      if (!res.ok) throw new Error('Failed to fetch overview')
      const data = await res.json()
      setData(data)
    } catch (error) {
      console.error('[PortfolioOverview] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Loading skeletons
  if (loading) {
    return (
      <div className="space-y-6 mb-8">
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6 bg-elev-2 border-border/40 animate-pulse">
              <div className="h-4 bg-elev-1 rounded w-1/2 mb-3" />
              <div className="h-8 bg-elev-1 rounded w-3/4 mb-2" />
              <div className="h-3 bg-elev-1 rounded w-1/3" />
            </Card>
          ))}
        </div>

        {/* Sparkline + Category Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-6 bg-elev-2 border-border/40 lg:col-span-2 animate-pulse">
            <div className="h-4 bg-elev-1 rounded w-1/4 mb-4" />
            <div className="h-32 bg-elev-1 rounded" />
          </Card>
          <Card className="p-6 bg-elev-2 border-border/40 animate-pulse">
            <div className="h-4 bg-elev-1 rounded w-1/2 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-elev-1 rounded" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || data.isEmpty) {
    return (
      <Card className="p-12 bg-elev-2 border-border/40 mb-8">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-elev-1 border border-border/40 flex items-center justify-center mx-auto mb-4">
            <Search className="h-7 w-7 text-muted" />
          </div>
          <h3 className="font-cinzel font-bold text-xl text-fg mb-2">
            Your portfolio is empty
          </h3>
          <p className="text-sm text-muted mb-6">
            Start tracking your sealed Pokémon products by adding your first item
          </p>
          <Button
            onClick={onOpenQuickAdd}
            className={cn(
              "bg-accent text-black border border-accent hover:bg-accent/90",
              "hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-120 font-medium"
            )}
          >
            <Search className="h-4 w-4 mr-2" />
            Open Quick-Add
          </Button>
        </div>
      </Card>
    )
  }

  const { kpis, series30d, categoryBreakdown, missingItems, meta } = data

  const plPositive = kpis.unrealisedPL >= 0
  const roiPositive = kpis.roi >= 0
  const delta7dPositive = (kpis.unrealisedPLDelta7d ?? 0) >= 0

  // Format timestamp for provenance
  const pricesAsOfDate = new Date(meta.pricesAsOf)
  const pricesAsOfFormatted = pricesAsOfDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-6 mb-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Value */}
        <Card className="p-6 bg-elev-2 border-border/40 hover:border-border transition-colors">
          <div className="flex items-start justify-between mb-3">
            <span className="label-up">
              Estimated Value
            </span>
            {kpis.missingPricesCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 h-5 text-amber-500 border-amber-500/40 bg-amber-500/10 cursor-pointer hover:bg-amber-500/20 transition-colors"
                title={`${kpis.missingPricesCount} items missing market prices - click to view`}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMissingPanel(!showMissingPanel)
                }}
              >
                <Info className="h-2.5 w-2.5 mr-0.5" />
                {kpis.missingPricesCount}
              </Badge>
            )}
          </div>
          <p className="heading mono kpi-number text-fg mb-2">
            {format(kpis.estimatedValue)}
          </p>
          <p className="kbd text-[10px]">
            Updated {pricesAsOfFormatted}
          </p>
        </Card>

        {/* Invested */}
        <Card className="p-6 bg-elev-2 border-border/40 hover:border-border transition-colors">
          <span className="label-up mb-3 block">
            Invested
          </span>
          <p className="heading mono kpi-number text-fg">
            {format(kpis.invested)}
          </p>
        </Card>

        {/* Unrealised P/L */}
        <Card className="p-6 bg-elev-2 border-border/40 hover:border-border transition-colors">
          <span className="label-up mb-3 block">
            Unrealised P/L
          </span>
          <div className="flex items-baseline gap-2 mb-1">
            <p className={cn(
              "heading mono kpi-number",
              plPositive ? "money-pos" : "money-neg"
            )}>
              {plPositive ? '+' : ''}{format(kpis.unrealisedPL)}
            </p>
            {kpis.unrealisedPLDelta7d !== null && (
              <span
                className={cn(
                  "text-xs font-semibold rounded-md flex items-center gap-1",
                  delta7dPositive ? "money-pos-tint" : "money-neg-tint"
                )}
              >
                {delta7dPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {delta7dPositive ? '+' : ''}{kpis.unrealisedPLDelta7d.toFixed(1)}%
              </span>
            )}
          </div>
        </Card>

        {/* ROI % */}
        <Card className="p-6 bg-elev-2 border-border/40 hover:border-border transition-colors">
          <span className="label-up mb-3 block">
            ROI %
          </span>
          <p className={cn(
            "heading mono kpi-number",
            roiPositive ? "money-pos" : "money-neg"
          )}>
            {roiPositive ? '+' : ''}{kpis.roi.toFixed(2)}%
          </p>
        </Card>
      </div>

      {/* Missing Items Panel */}
      {showMissingPanel && missingItems.length > 0 && (
        <Card className="p-4 bg-amber-500/5 border-amber-500/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium text-fg">
                {missingItems.length} {missingItems.length === 1 ? 'item' : 'items'} missing market prices
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMissingPanel(false)}
              className="h-7 text-xs text-muted hover:text-fg"
            >
              Dismiss
            </Button>
          </div>
          <div className="space-y-2">
            {missingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-elev-1 rounded-lg border border-border/40"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg font-mono">{item.sku}</p>
                  {item.size_uk && (
                    <p className="text-xs text-muted">Size: {item.size_uk} UK</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-border hover:border-accent/40"
                    onClick={() => {
                      // TODO: Trigger price lookup for this SKU
                      console.log('Lookup prices for', item.sku)
                    }}
                  >
                    Lookup Prices
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-border hover:border-accent/40"
                    onClick={() => {
                      // TODO: Navigate to edit view
                      window.location.href = `/portfolio/inventory?edit=${item.id}`
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 30-day Sparkline + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 30-day Portfolio Value */}
        <Card className="p-6 bg-elev-2 border-border/40 lg:col-span-2">
          <span className="label-up mb-4 block">
            30-Day Portfolio Value
          </span>
          {series30d.length > 0 && series30d.some(s => s.value !== null) ? (
            <div className="h-32 flex items-center justify-center">
              <Sparkline
                data={series30d.map(s => s.value ?? 0).filter((v): v is number => v !== null)}
                width={600}
                height={128}
                color="rgb(196, 164, 132)"
              />
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-sm text-muted">
              Insufficient historical data
            </div>
          )}
        </Card>

        {/* Category Breakdown */}
        <Card className="p-6 bg-elev-2 border-border/40">
          <span className="label-up mb-4 block">
            By Category
          </span>
          {categoryBreakdown.length > 0 ? (
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted capitalize">{cat.category}</span>
                    <span className="text-sm font-mono font-semibold text-fg tabular-nums">
                      {format(cat.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-elev-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/60 transition-all duration-300"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">
                    {cat.percentage.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">No categories</div>
          )}
        </Card>
      </div>
    </div>
  )
}
