'use client'

import { cn } from '@/lib/utils/cn'
import { gbp2 } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type TimeRange = '7d' | '30d' | '90d' | '1y'

export interface MarketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    name: string
    sku: string
    imageUrl?: string
    brand?: string
    colorway?: string
  }
  sizes: string[]
  activeSize: string
  onSizeChange: (size: string) => void
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
  series: { date: string; price: number }[]
  sourceBadge?: string
  lastUpdatedISO?: string
  loading?: boolean
  error?: string
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
]

const formatRelativeTime = (isoString: string): string => {
  const now = new Date()
  const then = new Date(isoString)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function MarketModal({
  open,
  onOpenChange,
  product,
  sizes,
  activeSize,
  onSizeChange,
  range,
  onRangeChange,
  series,
  sourceBadge,
  lastUpdatedISO,
  loading = false,
  error,
}: MarketModalProps) {
  // Calculate current price and delta
  const currentPrice = series.length > 0 ? series[series.length - 1].price : 0
  const firstPrice = series.length > 0 ? series[0].price : 0
  const delta = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0
  const isPositive = delta > 0
  const isNegative = delta < 0

  // Format chart data
  const chartData = series.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    }),
    price: point.price,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] bg-elev-2/95 backdrop-blur-md gradient-elev border-border p-0 overflow-hidden shadow-xl">
        <div className="grid md:grid-cols-[300px_1fr] gap-0">
          {/* Left: Product Hero */}
          <div className="bg-elev-1 p-6 space-y-4 border-r border-border/40">
            {/* Image */}
            <div className="aspect-square bg-elev-3 rounded-xl overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dim">
                  No image
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-2">
              {product.brand && (
                <div className="text-xs font-medium text-accent uppercase tracking-wide">
                  {product.brand}
                </div>
              )}
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-fg leading-tight">
                  {product.name}
                </DialogTitle>
              </DialogHeader>
              {product.colorway && (
                <p className="text-sm text-dim">{product.colorway}</p>
              )}
              <Badge
                variant="outline"
                className="font-mono text-xs border-border/60"
              >
                {product.sku}
              </Badge>
            </div>

            {/* Provenance */}
            {sourceBadge && lastUpdatedISO && (
              <div className="pt-4 border-t border-border/40">
                <div className="text-xs text-dim">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {sourceBadge}
                  </div>
                  <div className="mt-1 font-mono">
                    Updated {formatRelativeTime(lastUpdatedISO)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Chart & Controls */}
          <div className="p-6 space-y-4">
            {/* Header: Price & Delta */}
            <div className="flex items-baseline justify-between">
              <div className="space-y-1">
                <div className="text-2xl font-mono font-bold text-fg">
                  {gbp2.format(currentPrice)}
                </div>
                {series.length > 1 && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm font-mono',
                      isPositive && 'text-green-400',
                      isNegative && 'text-red-400'
                    )}
                  >
                    {isPositive && <TrendingUp className="h-4 w-4" />}
                    {isNegative && <TrendingDown className="h-4 w-4" />}
                    <span>
                      {isPositive && '+'}
                      {delta.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Time Range Tabs */}
              <div className="flex gap-1 bg-elev-1 rounded-lg p-1">
                {TIME_RANGES.map((tr) => (
                  <button
                    key={tr.value}
                    onClick={() => onRangeChange(tr.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-120',
                      range === tr.value
                        ? 'bg-accent text-black'
                        : 'text-dim hover:text-fg hover:bg-elev-2'
                    )}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selector */}
            <div className="space-y-2">
              <div className="text-xs text-dim uppercase tracking-wide">
                Size (UK)
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => onSizeChange(size)}
                    className={cn(
                      'shrink-0 snap-start px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-120 border',
                      activeSize === size
                        ? 'bg-accent text-black border-accent'
                        : 'bg-elev-1 text-fg border-border hover:border-accent/60'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="h-[280px] w-full">
              {loading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : series.length === 0 ? (
                <div className="h-full flex items-center justify-center text-dim text-sm">
                  No data for selection
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="archvdArea" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="hsl(var(--accent))"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(var(--accent))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--accent-200) / 0.25)"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--dim))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--dim))', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `£${value}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null
                        return (
                          <div className="bg-elev-3 border-l-2 border-l-accent-400 px-3 py-2 rounded shadow-lg">
                            <div className="text-xs text-dim">
                              {payload[0].payload.date}
                            </div>
                            <div className="text-sm font-mono font-medium text-fg">
                              {gbp2.format(payload[0].value as number)}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2.5}
                      fill="url(#archvdArea)"
                      animationDuration={200}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
