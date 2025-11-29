/**
 * Top Performers Table
 * Shows best and worst performing items by profit
 */

'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Trophy, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import type { TopPerformer } from '@/hooks/useAnalytics'

interface TopPerformersTableProps {
  topPerformers: TopPerformer[]
  worstPerformers: TopPerformer[]
  className?: string
}

export function TopPerformersTable({ topPerformers, worstPerformers, className }: TopPerformersTableProps) {
  const { format } = useCurrency()
  const [view, setView] = useState<'top' | 'worst'>('top')

  const performers = view === 'top' ? topPerformers : worstPerformers

  if (performers.length === 0) {
    return (
      <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-6', className)}>
        <div className="text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-dim opacity-50" />
          <p className="text-sm text-muted">No sales data available yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-5', className)}>
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {view === 'top' ? (
            <Trophy className="h-5 w-5 text-[#00FF94]" />
          ) : (
            <ThumbsDown className="h-5 w-5 text-red-400" />
          )}
          <h3 className="text-lg font-semibold text-fg">Performance Leaders</h3>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-elev-0 rounded-lg p-1 border border-border/30">
          <button
            onClick={() => setView('top')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'top'
                ? 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/30'
                : 'text-muted hover:text-fg'
            )}
          >
            <TrendingUp className="h-3 w-3 inline mr-1" />
            Top Performers
          </button>
          <button
            onClick={() => setView('worst')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              view === 'worst'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-muted hover:text-fg'
            )}
          >
            <TrendingDown className="h-3 w-3 inline mr-1" />
            Worst Performers
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="space-y-2">
        {performers.map((performer, index) => {
          const isPositive = performer.profit >= 0

          return (
            <div
              key={performer.id}
              className="flex items-center justify-between p-3 bg-elev-0 rounded-lg border border-border/30 hover:border-accent/30 transition-all"
            >
              {/* Rank */}
              <div className="flex items-center gap-3 flex-1">
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm',
                  index === 0 && view === 'top' && 'bg-[#FFD700]/20 text-[#FFD700]',
                  index === 1 && view === 'top' && 'bg-[#C0C0C0]/20 text-[#C0C0C0]',
                  index === 2 && view === 'top' && 'bg-[#CD7F32]/20 text-[#CD7F32]',
                  index > 2 && 'bg-elev-2 text-dim'
                )}>
                  {index + 1}
                </div>

                {/* Product Info */}
                <ProductLineItem
                  imageUrl={performer.image_url || null}
                  imageAlt={`${performer.brand} ${performer.model}`}
                  brand={performer.brand || ''}
                  model={performer.model || ''}
                  variant={undefined}
                  sku={performer.sku}
                  href={`/portfolio/inventory`}
                  category="sneakers"
                  className="flex-1"
                />
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-6 ml-4">
                <div className="text-right">
                  <div className="text-xs text-dim">Profit</div>
                  <div className={cn(
                    'text-sm font-bold mono',
                    isPositive ? 'text-[#00FF94]' : 'text-red-400'
                  )}>
                    {isPositive ? '+' : ''}{format(performer.profit)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-dim">Margin</div>
                  <div className={cn(
                    'text-sm font-bold mono',
                    performer.margin >= 20 ? 'text-[#00FF94]' :
                    performer.margin >= 10 ? 'text-blue-400' :
                    performer.margin >= 0 ? 'text-amber-400' :
                    'text-red-400'
                  )}>
                    {performer.margin >= 0 ? '+' : ''}{performer.margin.toFixed(1)}%
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-dim">Days to Sell</div>
                  <div className={cn(
                    'text-sm font-bold mono',
                    performer.daysToSell <= 30 ? 'text-[#00FF94]' :
                    performer.daysToSell <= 90 ? 'text-blue-400' :
                    performer.daysToSell <= 180 ? 'text-amber-400' :
                    'text-red-400'
                  )}>
                    {performer.daysToSell}d
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      {performers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">
              Avg Profit
            </div>
            <div className={cn(
              'text-lg font-bold mono',
              view === 'top' ? 'text-[#00FF94]' : 'text-red-400'
            )}>
              {format(performers.reduce((sum, p) => sum + p.profit, 0) / performers.length)}
            </div>
          </div>
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">
              Avg Margin
            </div>
            <div className="text-lg font-bold text-fg mono">
              {(performers.reduce((sum, p) => sum + p.margin, 0) / performers.length).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-dim uppercase tracking-wide mb-1">
              Avg Days
            </div>
            <div className="text-lg font-bold text-fg mono">
              {Math.round(performers.reduce((sum, p) => sum + p.daysToSell, 0) / performers.length)}d
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
