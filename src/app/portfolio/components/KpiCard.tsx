'use client'

import { Card } from '@/components/ui/card'
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
      <Card elevation="soft" className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-24" />
          {period && <Skeleton className="h-4 w-12" />}
        </div>
        <Skeleton className="h-9 w-32 mt-2" />
        {delta !== undefined && <Skeleton className="h-4 w-16 mt-3" />}
      </Card>
    )
  }

  return (
    <Card elevation="soft" className="p-5 md:p-6 hover-elevate">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="label-up">{label}</span>
          {tooltip && (
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-dim cursor-help transition-colors hover:text-muted" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-fg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-boutique z-10 shadow-medium">
                {tooltip}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-border"></div>
              </div>
            </div>
          )}
        </div>
        {period && (
          <span className="kbd">
            {period}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="heading mono text-[32px] leading-none text-fg">
          {value}
        </span>
        {delta !== undefined && (
          <span className={`text-sm font-semibold rounded-md flex items-center gap-1 ${delta >= 0 ? 'money-pos-tint' : 'money-neg-tint'}`}>
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </Card>
  )
}
