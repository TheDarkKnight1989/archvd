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

  return (
    <Card elevation="soft">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {items.map((item, idx) => {
            // Clamp percentage to 0-100 range
            const clampedPct = Math.max(0, Math.min(100, item.pct))
            const displayPct = clampedPct.toFixed(1)

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
                    style={{ width: `${clampedPct}%` }}
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
