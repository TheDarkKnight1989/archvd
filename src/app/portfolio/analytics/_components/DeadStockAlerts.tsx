/**
 * Dead Stock Alerts Component
 * Shows critical alerts for items that need attention
 */

'use client'

import { AlertCircle, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Button } from '@/components/ui/button'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import type { InventoryItem } from '@/hooks/useAnalytics'

interface DeadStockAlertsProps {
  deadStockItems: InventoryItem[]
  deadStockValue: number
  className?: string
}

export function DeadStockAlerts({ deadStockItems, deadStockValue, className }: DeadStockAlertsProps) {
  const { format } = useCurrency()

  if (deadStockItems.length === 0) {
    return (
      <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-6', className)}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#00FF94]/10 mb-4">
            <AlertCircle className="h-8 w-8 text-[#00FF94]" />
          </div>
          <h3 className="text-lg font-semibold text-fg mb-2">All Clear!</h3>
          <p className="text-sm text-muted">
            No dead stock detected. Your inventory is healthy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 border border-red-500/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Dead Stock Alert</h3>
            <p className="text-sm text-muted mt-0.5">
              Items sitting for 180+ days need action
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-dim uppercase tracking-wide">Capital Tied Up</div>
          <div className="text-xl font-bold text-red-400 mono">{format(deadStockValue)}</div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Items</div>
          <div className="text-lg font-bold text-red-400 mono">{deadStockItems.length}</div>
        </div>
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Value</div>
          <div className="text-lg font-bold text-red-400 mono">
            {format(deadStockValue / deadStockItems.length)}
          </div>
        </div>
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Oldest</div>
          <div className="text-lg font-bold text-red-400 mono">
            {Math.floor(
              (new Date().getTime() -
                new Date(deadStockItems[0]?.purchase_date || deadStockItems[0]?.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )}d
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      <div className="mb-4 p-3 bg-elev-0 rounded-lg border border-border/30">
        <div className="text-xs font-semibold text-[#00FF94] uppercase tracking-wide mb-2">
          Recommended Actions
        </div>
        <div className="space-y-2 text-sm text-muted">
          <div className="flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Consider 15-20% markdown to move inventory quickly</span>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>List on additional platforms for more exposure</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Bundle with popular items for faster sale</span>
          </div>
        </div>
      </div>

      {/* Top Dead Stock Items (first 5) */}
      {deadStockItems.length > 0 && (
        <>
          <div className="text-xs font-semibold text-dim uppercase tracking-wide mb-3">
            Critical Items ({deadStockItems.length})
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {deadStockItems.slice(0, 5).map((item) => {
              const daysOld = Math.floor(
                (new Date().getTime() -
                  new Date(item.purchase_date || item.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
              const itemCost = item.purchase_price + (item.tax || 0) + (item.shipping || 0)

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-elev-0 rounded-lg border border-border/30 hover:border-red-500/30 transition-all"
                >
                  <ProductLineItem
                    imageUrl={item.image_url || null}
                    imageAlt={`${item.brand} ${item.model}`}
                    brand={item.brand || ''}
                    model={item.model || ''}
                    variant={item.colorway || undefined}
                    sku={item.sku}
                    href={`/portfolio/inventory`}
                    sizeUk={item.size_uk || undefined}
                    sizeSystem="UK"
                    category={(item.category?.toLowerCase() as any) || 'other'}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <div className="text-xs text-dim">Days Old</div>
                      <div className="text-sm font-bold text-red-400 mono">{daysOld}d</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-dim">Cost</div>
                      <div className="text-sm font-bold text-fg mono">{format(itemCost)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {deadStockItems.length > 5 && (
            <div className="mt-3 text-center">
              <Button variant="outline" size="sm" className="text-xs">
                View All {deadStockItems.length} Items
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
