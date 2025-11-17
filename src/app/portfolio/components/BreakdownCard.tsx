'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/hooks/useCurrency'

interface BreakdownItem {
  label: string
  value: number
  pct: number
}

interface BreakdownCardProps {
  title: string
  items: BreakdownItem[]
  loading?: boolean
}

export function BreakdownCard({ title, items, loading }: BreakdownCardProps) {
  const { convert, format } = useCurrency()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card elevation="soft">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted">
            <p className="text-sm font-medium">No data available</p>
            <p className="text-xs mt-1.5 text-dim">Add items to see breakdown</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Normalize percentages to ensure they sum to 100%
  const normalizedItems = (() => {
    if (items.length === 0) return items

    // Calculate raw percentages sum
    const rawSum = items.reduce((sum, item) => sum + item.pct, 0)

    // If sum is already very close to 100, just use raw percentages
    if (Math.abs(rawSum - 100) < 0.01) {
      return items
    }

    // Normalize to 100%
    const factor = 100 / rawSum
    const normalized = items.map((item, idx) => ({
      ...item,
      normalizedPct: item.pct * factor
    }))

    // Round all percentages
    const rounded = normalized.map(item => ({
      ...item,
      displayPct: Math.round(item.normalizedPct * 10) / 10 // Round to 1 decimal
    }))

    // Calculate the rounding error
    const roundedSum = rounded.reduce((sum, item) => sum + item.displayPct, 0)
    const error = 100 - roundedSum

    // Add the error to the largest item
    if (Math.abs(error) > 0.01) {
      const largestIdx = rounded.reduce((maxIdx, item, idx, arr) =>
        item.value > arr[maxIdx].value ? idx : maxIdx
      , 0)
      rounded[largestIdx].displayPct += error
    }

    return rounded
  })()

  return (
    <Card elevation="soft">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {normalizedItems.map((item, idx) => {
            const displayPct = (item as any).displayPct?.toFixed(1) || item.pct.toFixed(1)
            const barWidth = Math.max(0, Math.min(100, (item as any).normalizedPct || item.pct))

            return (
              <li key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-fg">{item.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="num text-xs text-muted">{displayPct}%</span>
                    <span className="num text-sm font-medium text-fg">{format(convert(item.value, 'GBP'))}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-soft overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-accent transition-all duration-200 ease-out"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
