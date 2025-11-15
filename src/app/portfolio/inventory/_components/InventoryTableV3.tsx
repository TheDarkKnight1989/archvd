'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Package, Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

// Cell components
import { ItemCell, ItemCellSkeleton } from './cells/ItemCell'
import { MarketPriceCell, MarketPriceCellSkeleton } from './cells/MarketPriceCell'
import { InstantSellCell } from './cells/InstantSellCell'
import { SparklineCell, SparklineCellSkeleton } from './cells/SparklineCell'
import { MoneyCell, QtyCell, MoneyCellSkeleton } from './cells/MoneyCell'
import { ProfitLossCell, ProfitLossCellSkeleton } from './cells/ProfitLossCell'
import { PerformanceCell, PerformanceCellSkeleton } from './cells/PerformanceCell'
import { ActionsCell } from './cells/ActionsCell'

export interface InventoryTableV3Props {
  items: EnrichedLineItem[]
  loading: boolean
  onRowClick?: (item: EnrichedLineItem) => void
  onEdit?: (item: EnrichedLineItem) => void
  onMarkSold?: (item: EnrichedLineItem) => void
  onAddExpense?: (item: EnrichedLineItem) => void
  onAddToWatchlist?: (item: EnrichedLineItem) => void
  onAddItem?: () => void
}

/**
 * InventoryTableV3 - Modern inventory table with 11 columns
 * WHY: Clean, scannable layout with sticky left column and consistent styling
 *
 * Columns:
 * 1. Card (sticky left) - image, brand/model, colorway, chips
 * 2. Purchase Date
 * 3. Market Price (with provenance)
 * 4. Instant Sell (highest bid with fees)
 * 5. Sparkline (30-day)
 * 6. Qty
 * 7. Total
 * 8. Invested (with avg per unit)
 * 9. P/L
 * 10. Performance %
 * 11. Actions
 */
export function InventoryTableV3({
  items,
  loading,
  onRowClick,
  onEdit,
  onMarkSold,
  onAddExpense,
  onAddToWatchlist,
  onAddItem,
}: InventoryTableV3Props) {
  const { format } = useCurrency()
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDesc, setSortDesc] = useState(true)

  // Handle column header clicks for sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDesc(!sortDesc)
    } else {
      // New column, default to descending
      setSortBy(column)
      setSortDesc(true)
    }
  }

  // Sort items based on current sort state
  const sortedItems = useMemo(() => {
    if (!sortBy) return items

    return [...items].sort((a, b) => {
      let aVal: any
      let bVal: any

      // Extract values based on sort column
      switch (sortBy) {
        case 'purchaseDate':
          aVal = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0
          bVal = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0
          break
        case 'market':
          aVal = a.market.price ?? 0
          bVal = b.market.price ?? 0
          break
        case 'instantSell':
          aVal = a.instantSell.gross ?? 0
          bVal = b.instantSell.gross ?? 0
          break
        case 'qty':
          aVal = a.qty ?? 0
          bVal = b.qty ?? 0
          break
        case 'total':
          aVal = a.total ?? 0
          bVal = b.total ?? 0
          break
        case 'invested':
          aVal = a.invested ?? 0
          bVal = b.invested ?? 0
          break
        case 'pl':
          aVal = a.pl ?? 0
          bVal = b.pl ?? 0
          break
        case 'performance':
          aVal = a.performancePct ?? 0
          bVal = b.performancePct ?? 0
          break
        default:
          return 0
      }

      // Compare values
      if (aVal < bVal) return sortDesc ? 1 : -1
      if (aVal > bVal) return sortDesc ? -1 : 1
      return 0
    })
  }, [items, sortBy, sortDesc])

  // Sortable header component
  const SortableHeader = ({ column, label, align = 'left' }: { column: string; label: string; align?: 'left' | 'right' | 'center' }) => {
    const isActive = sortBy === column
    const Icon = isActive ? (sortDesc ? ArrowDown : ArrowUp) : ArrowUpDown

    return (
      <button
        onClick={() => handleSort(column)}
        className={cn(
          'flex items-center gap-1.5 hover:text-accent transition-colors group w-full',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
          isActive && 'text-accent'
        )}
      >
        <span>{label}</span>
        <Icon className={cn(
          'h-3.5 w-3.5 transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
        )} />
      </button>
    )
  }

  if (loading) {
    return <InventoryTableV3Skeleton />
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px] rounded-2xl border border-border bg-surface shadow-soft">
        <div className="text-center px-6 py-16">
          <div className="inline-block mb-6">
            <Package className="h-16 w-16 mx-auto text-muted" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-semibold text-fg mb-3">Your inventory is empty</h3>
          <p className="text-sm text-muted mb-8 max-w-sm mx-auto leading-relaxed">
            Start building your portfolio by adding your first item. Track market values, monitor performance, and manage your collection.
          </p>
          {onAddItem && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-fg font-medium rounded-xl hover:bg-accent-600 transition-boutique active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Add Your First Item
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Card View (< 1024px) */}
      <div className="lg:hidden space-y-3">
        {items.map((item) => (
          <MobileInventoryCard
            key={item.id}
            item={item}
            onClick={() => onRowClick?.(item)}
            onEdit={() => onEdit?.(item)}
            onMarkSold={() => onMarkSold?.(item)}
            onAddExpense={() => onAddExpense?.(item)}
            onAddToWatchlist={() => onAddToWatchlist?.(item)}
          />
        ))}
      </div>

      {/* Desktop Table View (>= 1024px) */}
      <div className="hidden lg:block rounded-2xl border border-border bg-surface shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className="sticky top-0 bg-panel border-b border-keyline z-10">
              <tr>
                <th className="px-4 py-3.5 text-left label-up sticky left-0 bg-panel border-r border-border/20 min-w-[280px]">
                  Card
                </th>
                <th className="px-4 py-3.5 text-left label-up w-[120px]">
                  <SortableHeader column="purchaseDate" label="Purchase" align="left" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[140px]">
                  <SortableHeader column="market" label="Market" align="right" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[140px]">
                  <SortableHeader column="instantSell" label="Instant Sell" align="right" />
                </th>
                <th className="px-4 py-3.5 text-center label-up w-[110px]">30d Trend</th>
                <th className="px-4 py-3.5 text-center label-up w-[80px]">
                  <SortableHeader column="qty" label="Qty" align="center" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[100px]">
                  <SortableHeader column="total" label="Total" align="right" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[120px]">
                  <SortableHeader column="invested" label="Invested" align="right" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[120px]">
                  <SortableHeader column="pl" label="Unrealised P/L" align="right" />
                </th>
                <th className="px-4 py-3.5 text-right label-up w-[110px]">
                  <SortableHeader column="performance" label="Performance %" align="right" />
                </th>
                <th className="px-4 py-3.5 text-center label-up w-[80px]"></th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {sortedItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-border last:border-b-0 cursor-pointer transition-colors h-16',
                    'hover:bg-table-hover',
                    idx % 2 === 0 ? 'bg-table-zebra' : 'bg-panel'
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {/* 1. Card (sticky left) */}
                  <td className="px-4 py-3 sticky left-0 bg-inherit border-r border-border/10 z-[1]">
                    <ItemCell item={item} onClick={() => onRowClick?.(item)} />
                  </td>

                  {/* 2. Purchase Date */}
                  <td className="px-4 py-3">
                    {item.purchaseDate ? (
                      <div className="text-sm text-fg mono">
                        {new Date(item.purchaseDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    ) : (
                      <span className="text-dim text-sm">—</span>
                    )}
                  </td>

                  {/* 3. Market Price */}
                  <td className="px-4 py-3">
                    <MarketPriceCell
                      price={item.market.price}
                      currency={item.market.currency}
                      provider={item.market.provider}
                      updatedAt={item.market.updatedAt}
                    />
                  </td>

                  {/* 4. Instant Sell */}
                  <td className="px-4 py-3">
                    <InstantSellCell
                      gross={item.instantSell.gross}
                      net={item.instantSell.net}
                      currency={item.instantSell.currency}
                      provider={item.instantSell.provider}
                      updatedAt={item.instantSell.updatedAt}
                      feePct={item.instantSell.feePct}
                    />
                  </td>

                  {/* 5. Sparkline */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <SparklineCell data={item.market.spark30d} width={96} height={18} />
                    </div>
                  </td>

                  {/* 5. Qty */}
                  <td className="px-4 py-3">
                    <QtyCell value={item.qty} />
                  </td>

                  {/* 6. Total */}
                  <td className="px-4 py-3">
                    <MoneyCell value={item.total} />
                  </td>

                  {/* 7. Invested (with avg) */}
                  <td className="px-4 py-3">
                    <MoneyCell
                      value={item.invested}
                      subtitle={`avg ${format(item.avgCost)}`}
                    />
                  </td>

                  {/* 8. P/L */}
                  <td className="px-4 py-3">
                    <ProfitLossCell value={item.pl} />
                  </td>

                  {/* 9. Performance % */}
                  <td className="px-4 py-3">
                    <PerformanceCell value={item.performancePct} />
                  </td>

                  {/* 10. Actions */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <ActionsCell
                      status={item.status}
                      onEdit={() => onEdit?.(item)}
                      onMarkSold={() => onMarkSold?.(item)}
                      onAddExpense={() => onAddExpense?.(item)}
                      onAddToWatchlist={() => onAddToWatchlist?.(item)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/**
 * Mobile card component for <1024px screens
 */
function MobileInventoryCard({
  item,
  onClick,
  onEdit,
  onMarkSold,
  onAddExpense,
  onAddToWatchlist,
}: {
  item: EnrichedLineItem
  onClick?: () => void
  onEdit?: () => void
  onMarkSold?: () => void
  onAddExpense?: () => void
  onAddToWatchlist?: () => void
}) {
  const { format } = useCurrency()

  return (
    <div
      className="p-4 rounded-xl border border-border bg-surface shadow-soft cursor-pointer hover:border-accent/50 transition-colors"
      onClick={onClick}
    >
      {/* Item */}
      <div className="mb-3">
        <ItemCell item={item} onClick={onClick} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-dim mb-1">Invested</div>
          <div className="font-medium mono">{format(item.invested)}</div>
        </div>
        <div>
          <div className="text-xs text-dim mb-1">Market</div>
          <div className="font-medium mono">{item.market.price ? format(item.market.price) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-dim mb-1">P/L</div>
          <div className={cn('font-medium mono', item.pl && item.pl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]')}>
            {item.pl !== null ? format(item.pl) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-dim mb-1">Performance</div>
          <div className={cn('font-medium mono', item.performancePct && item.performancePct >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]')}>
            {item.performancePct !== null ? `${item.performancePct.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {item.market.spark30d.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-dim mb-2">30-day trend</div>
          <SparklineCell data={item.market.spark30d} width={160} height={24} />
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 pt-3 border-t border-border flex justify-end" onClick={(e) => e.stopPropagation()}>
        <ActionsCell
          status={item.status}
          onEdit={onEdit}
          onMarkSold={onMarkSold}
          onAddExpense={onAddExpense}
          onAddToWatchlist={onAddToWatchlist}
        />
      </div>
    </div>
  )
}

/**
 * Skeleton for loading state
 */
export function InventoryTableV3Skeleton() {
  return (
    <>
      {/* Mobile Skeleton */}
      <div className="lg:hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border bg-surface shadow-soft">
            <ItemCellSkeleton />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyCellSkeleton />
              <MoneyCellSkeleton />
              <MoneyCellSkeleton />
              <MoneyCellSkeleton />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden lg:block rounded-2xl border border-border bg-surface shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-panel border-b border-keyline">
              <tr>
                <th className="px-4 py-3.5 text-left label-up sticky left-0 bg-panel min-w-[280px]">Card</th>
                <th className="px-4 py-3.5 text-left label-up w-[120px]">Purchase</th>
                <th className="px-4 py-3.5 text-right label-up w-[140px]">Market</th>
                <th className="px-4 py-3.5 text-center label-up w-[110px]">30d Trend</th>
                <th className="px-4 py-3.5 text-center label-up w-[80px]">Qty</th>
                <th className="px-4 py-3.5 text-right label-up w-[100px]">Total</th>
                <th className="px-4 py-3.5 text-right label-up w-[120px]">Invested</th>
                <th className="px-4 py-3.5 text-right label-up w-[100px]">P/L</th>
                <th className="px-4 py-3.5 text-right label-up w-[100px]">Performance</th>
                <th className="px-4 py-3.5 text-center label-up w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={cn('border-b border-border h-16', i % 2 === 0 ? 'bg-table-zebra' : 'bg-panel')}>
                  <td className="px-4 py-3 sticky left-0 bg-inherit"><ItemCellSkeleton /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-elev-2 animate-pulse rounded" /></td>
                  <td className="px-4 py-3"><MarketPriceCellSkeleton /></td>
                  <td className="px-4 py-3"><div className="flex justify-center"><SparklineCellSkeleton /></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-elev-2 animate-pulse rounded mx-auto" /></td>
                  <td className="px-4 py-3"><MoneyCellSkeleton /></td>
                  <td className="px-4 py-3"><MoneyCellSkeleton /></td>
                  <td className="px-4 py-3"><ProfitLossCellSkeleton /></td>
                  <td className="px-4 py-3"><PerformanceCellSkeleton /></td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
