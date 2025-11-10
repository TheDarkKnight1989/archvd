'use client'

import { TrendingUp, TrendingDown, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatPct, deltaColor } from '@/lib/utils/format'
import { useCurrency } from '@/hooks/useCurrency'
import { Badge } from '@/components/ui/badge'
import type { EnrichedInventoryItem } from '@/hooks/usePortfolioInventory'

export interface InventoryCardProps {
  item: EnrichedInventoryItem
  onClick?: () => void
  onEdit?: () => void
  onToggleSold?: () => void
  onAddExpense?: () => void
}

export function InventoryCard({
  item,
  onClick,
  onEdit,
  onToggleSold,
  onAddExpense,
}: InventoryCardProps) {
  const { convert, format } = useCurrency()
  const initials = item.brand?.slice(0, 2).toUpperCase() || 'IT'
  const profit = item.profit
  const performancePct = item.performance_pct

  return (
    <div
      className={cn(
        'rounded-xl border border-[#15251B] bg-gradient-to-br from-[#08100C] to-[#0B1510] p-4',
        'transition-all duration-120 motion-reduce:transition-none hover:border-[#0F8D65]/30 hover:shadow-soft',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Header Row: Thumbnail + Title + Actions */}
      <div className="flex items-start gap-3 mb-4">
        {/* Thumbnail */}
        <div className="h-12 w-12 rounded-lg bg-[#0E1A15] flex items-center justify-center shrink-0 text-sm font-medium text-[#7FA08F]">
          {initials}
        </div>

        {/* Title + SKU */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-sm font-medium text-[#E8F6EE] truncate mb-1',
            item.status === 'sold' && 'opacity-80'
          )}>
            {item.full_title}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7FA08F] font-mono">{item.sku}</span>
            {item.size && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {item.size}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Open actions menu
          }}
          className="p-2 hover:bg-[#15251B] rounded-lg transition-colors duration-120 motion-reduce:transition-none"
        >
          <MoreVertical className="h-4 w-4 text-[#7FA08F]" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Purchase Price */}
        <div>
          <div className="text-xs text-[#7FA08F] mb-1">Purchase</div>
          <div className="text-sm font-mono font-medium text-[#E8F6EE]">
            {format(convert(item.invested, 'GBP'))}
          </div>
        </div>

        {/* Market Value */}
        <div>
          <div className="text-xs text-[#7FA08F] mb-1">Market</div>
          {item.market_value !== null && item.market_value !== undefined ? (
            <div className="text-sm font-mono font-medium text-[#E8F6EE]">
              {format(convert(item.market_value, 'GBP'))}
            </div>
          ) : (
            <div className="text-sm text-[#7FA08F]">—</div>
          )}
        </div>

        {/* Profit/Loss */}
        <div>
          <div className="text-xs text-[#7FA08F] mb-1">P/L</div>
          {profit !== null && profit !== undefined ? (
            <div className={cn(
              'text-sm font-mono font-medium flex items-center gap-1',
              deltaColor(profit)
            )}>
              {profit > 0 && <TrendingUp className="h-3 w-3" />}
              {profit < 0 && <TrendingDown className="h-3 w-3" />}
              <span>{profit >= 0 ? '+' : ''}{format(convert(Math.abs(profit), 'GBP'))}</span>
            </div>
          ) : (
            <div className="text-sm text-[#7FA08F]">—</div>
          )}
        </div>

        {/* Performance % */}
        <div>
          <div className="text-xs text-[#7FA08F] mb-1">Performance</div>
          {performancePct !== null && performancePct !== undefined ? (
            <div className={cn(
              'text-sm font-mono font-medium',
              deltaColor(performancePct)
            )}>
              {formatPct(performancePct)}
            </div>
          ) : (
            <div className="text-sm text-[#7FA08F]">—</div>
          )}
        </div>
      </div>

      {/* Status Badge */}
      {item.status && (
        <div className="mt-3 pt-3 border-t border-[#15251B]/40">
          <Badge
            variant={item.status === 'sold' ? 'default' : 'outline'}
            className="text-xs"
          >
            {item.status === 'active' ? 'Active' :
             item.status === 'listed' ? 'Listed' :
             item.status === 'worn' ? 'Worn' :
             item.status === 'sold' ? 'Sold' : item.status}
          </Badge>
        </div>
      )}
    </div>
  )
}

export function InventoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#15251B] bg-gradient-to-br from-[#08100C] to-[#0B1510] p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-12 w-12 rounded-lg bg-[#0E1A15]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#0E1A15] rounded w-3/4" />
          <div className="h-3 bg-[#0E1A15] rounded w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3 bg-[#0E1A15] rounded w-16 mb-1" />
            <div className="h-4 bg-[#0E1A15] rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
