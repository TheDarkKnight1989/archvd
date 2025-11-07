'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { gbp2 } from '@/lib/utils/format'

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
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-dim">
            <p className="text-sm">No data available</p>
            <p className="text-xs mt-1">Add items to see breakdown</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item, idx) => {
            // Clamp percentage to 0-100 range
            const clampedPct = Math.max(0, Math.min(100, item.pct))
            const displayPct = clampedPct.toFixed(1)

            return (
              <li key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="num text-xs text-dim">{displayPct}%</span>
                    <span className="num text-sm text-fg">{gbp2.format(item.value)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-accent-200">
                  <div
                    className="h-1.5 rounded-full bg-accent-500 transition-all duration-slow"
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
