'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  delta?: number
  period?: string
  loading?: boolean
}

export function KpiCard({ label, value, delta, period, loading }: KpiCardProps) {
  if (loading) {
    return (
      <Card className="p-4 md:p-5">
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
    <Card className="p-4 md:p-5 hover:shadow-glow transition-shadow duration-base">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
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
