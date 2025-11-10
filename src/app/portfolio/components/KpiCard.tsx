'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Info } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: number
  period?: string
  loading?: boolean
  tooltip?: string
}

export function KpiCard({ label, value, delta, period, loading, tooltip }: KpiCardProps) {
  if (loading) {
    return (
      <Card elevation={2} className="p-4 md:p-5 gradient-elev">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-3 w-24" />
          {period && <Skeleton className="h-5 w-8" />}
        </div>
        <Skeleton className="h-8 w-32 mt-2" />
        {delta !== undefined && <Skeleton className="h-4 w-16 mt-2" />}
      </Card>
    )
  }

  return (
    <Card elevation={2} className="p-4 md:p-5 gradient-elev glow-accent-hover">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted">{label}</span>
          {tooltip && (
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-muted cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-elev-3 border border-border rounded-lg text-xs text-fg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 shadow-lg">
                {tooltip}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-border"></div>
              </div>
            </div>
          )}
        </div>
        {period && (
          <Badge variant="outline" className="text-[11px] px-2 py-0.5">
            {period}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-2xl md:text-3xl font-semibold text-fg">
          {value}
        </span>
        {delta !== undefined && (
          <span className={`text-sm font-mono flex items-center gap-1 ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  )
}
