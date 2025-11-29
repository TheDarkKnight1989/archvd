/**
 * Inventory Aging Widget
 * Shows breakdown of inventory by age with visual indicators
 */

'use client'

import { useMemo } from 'react'
import { Clock, AlertTriangle, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import type { AgingBucket } from '@/hooks/useAnalytics'

interface InventoryAgingWidgetProps {
  agingBuckets: AgingBucket[]
  className?: string
}

export function InventoryAgingWidget({ agingBuckets, className }: InventoryAgingWidgetProps) {
  const { format } = useCurrency()

  // Calculate totals
  const totalItems = useMemo(() => {
    return agingBuckets.reduce((sum, bucket) => sum + bucket.count, 0)
  }, [agingBuckets])

  const totalValue = useMemo(() => {
    return agingBuckets.reduce((sum, bucket) => sum + bucket.totalValue, 0)
  }, [agingBuckets])

  return (
    <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-fg">Inventory Aging</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide">Total Items</div>
          <div className="text-xl font-bold text-fg mono">{totalItems}</div>
        </div>
      </div>

      {/* Aging Buckets */}
      <div className="space-y-3">
        {agingBuckets.map((bucket, index) => {
          const percentage = totalItems > 0 ? (bucket.count / totalItems) * 100 : 0

          return (
            <div key={bucket.range} className="group">
              {/* Bucket Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', bucket.color)}>
                    {bucket.range}
                  </span>
                  <span className="text-xs text-dim">({bucket.description})</span>
                  {index === 3 && bucket.count > 0 && (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-fg mono">{bucket.count} items</span>
                  <span className="text-sm text-muted mono">{format(bucket.totalValue)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 bg-elev-0 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    index === 0 && 'bg-[#00FF94]',
                    index === 1 && 'bg-blue-400',
                    index === 2 && 'bg-amber-400',
                    index === 3 && 'bg-red-400'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Percentage */}
              <div className="text-right mt-1">
                <span className="text-xs text-dim mono">{percentage.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-5 pt-5 border-t border-border/40 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Total Value</div>
          <div className="text-lg font-bold text-fg mono">{format(totalValue)}</div>
        </div>
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Value/Item</div>
          <div className="text-lg font-bold text-fg mono">
            {format(totalItems > 0 ? totalValue / totalItems : 0)}
          </div>
        </div>
      </div>

      {/* Health Indicator */}
      {agingBuckets[3].count > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <TrendingDown className="h-5 w-5 text-red-400 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-400">
              {agingBuckets[3].count} Dead Stock Items
            </div>
            <div className="text-xs text-red-300 mt-1">
              Items sitting for 180+ days. Consider repricing or markdown.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
