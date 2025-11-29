/**
 * Drill-Down Modal Component
 * Detailed breakdown when clicking on specific metrics or items
 */

'use client'

import { X, TrendingUp, Package, DollarSign, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ProductLineItem } from '@/components/product/ProductLineItem'

interface DrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  data: DrillDownData | null
  formatCurrency: (value: number) => string
}

export type DrillDownData = {
  type: 'brand' | 'platform' | 'category' | 'week' | 'item'
  title: string
  items: any[]
  summary?: {
    revenue: number
    profit: number
    margin: number
    count: number
  }
}

export function DrillDownModal({
  isOpen,
  onClose,
  data,
  formatCurrency
}: DrillDownModalProps) {
  if (!isOpen || !data) return null

  const { type, title, items, summary } = data

  // Calculate metrics if not provided
  const metrics = summary || {
    revenue: items.reduce((sum, item) => sum + (item.salePrice || 0), 0),
    profit: items.reduce((sum, item) => sum + (item.margin || 0), 0),
    margin: 0,
    count: items.length
  }

  metrics.margin = metrics.revenue > 0 ? (metrics.profit / metrics.revenue) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-[#111111]/95 backdrop-blur-md border border-border/50 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-fg">{title}</h2>
            <p className="text-sm text-muted mt-1">
              {getCategoryLabel(type)} • {metrics.count} sales
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-elev-0 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-dim" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-5 border-b border-border bg-elev-0">
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Revenue</div>
            <div className="text-lg font-bold text-accent mono">
              {formatCurrency(metrics.revenue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Profit</div>
            <div className={cn(
              'text-lg font-bold mono',
              metrics.profit >= 0 ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {formatCurrency(metrics.profit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Margin</div>
            <div className={cn(
              'text-lg font-bold mono',
              metrics.margin >= 15 ? 'text-[#00FF94]' : metrics.margin >= 5 ? 'text-amber-400' : 'text-red-400'
            )}>
              {metrics.margin.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Sale</div>
            <div className="text-lg font-bold text-fg mono">
              {formatCurrency(metrics.revenue / metrics.count)}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            {items.map((item, index) => {
              const itemMargin = item.salePrice > 0
                ? ((item.margin || 0) / item.salePrice) * 100
                : 0

              return (
                <div
                  key={item.id || index}
                  className="p-3 bg-elev-1 rounded-lg border border-border/30 hover:border-border transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Product Info */}
                    <div className="flex-1">
                      <ProductLineItem
                        imageUrl={item.image_url || null}
                        imageAlt={`${item.brand} ${item.model}`}
                        brand={item.brand || ''}
                        model={item.model || ''}
                        variant={item.colorway}
                        sku={item.sku}
                        href={`/portfolio/inventory`}
                        sizeUk={item.size_uk || item.size}
                        sizeSystem="UK"
                        category="sneakers"
                      />
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.saleDate || item.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        {item.platform && (
                          <div className="px-2 py-0.5 bg-elev-0 rounded text-xs">
                            {item.platform}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4 text-right min-w-[300px]">
                      <div>
                        <div className="text-xs text-dim mb-0.5">Buy</div>
                        <div className="text-sm font-bold text-fg mono">
                          {formatCurrency(item.buyPrice || item.cost || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-dim mb-0.5">Sell</div>
                        <div className="text-sm font-bold text-accent mono">
                          {formatCurrency(item.salePrice || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-dim mb-0.5">Profit</div>
                        <div className={cn(
                          'text-sm font-bold mono',
                          (item.margin || 0) >= 0 ? 'text-[#00FF94]' : 'text-red-400'
                        )}>
                          {formatCurrency(item.margin || 0)}
                        </div>
                        <div className={cn(
                          'text-xs mono mt-0.5',
                          itemMargin >= 15 ? 'text-[#00FF94]' : itemMargin >= 5 ? 'text-amber-400' : 'text-red-400'
                        )}>
                          {itemMargin.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-elev-0 flex items-center justify-between">
          <div className="text-xs text-muted">
            Showing {items.length} of {items.length} items
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent/20 text-fg rounded-lg hover:bg-accent/30 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function getCategoryLabel(type: DrillDownData['type']): string {
  switch (type) {
    case 'brand': return 'Brand Performance'
    case 'platform': return 'Platform Sales'
    case 'category': return 'Category Breakdown'
    case 'week': return 'Weekly Details'
    case 'item': return 'Item Details'
    default: return 'Details'
  }
}
