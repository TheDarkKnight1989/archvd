/**
 * Repricing Suggestions Widget
 * Shows AI-powered price suggestions to optimize sales
 */

'use client'

import { useState } from 'react'
import { TrendingDown, Zap, Check, X, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Button } from '@/components/ui/button'
import { ProductLineItem } from '@/components/product/ProductLineItem'
import type { RepricingSuggestion } from '@/hooks/useRepricingSuggestions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RepricingSuggestionsWidgetProps {
  suggestions: RepricingSuggestion[]
  onApply: (suggestion: RepricingSuggestion) => Promise<void>
  onApplyAll?: () => void
  className?: string
}

export function RepricingSuggestionsWidget({
  suggestions,
  onApply,
  onApplyAll,
  className
}: RepricingSuggestionsWidgetProps) {
  const { format } = useCurrency()
  const [applying, setApplying] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.itemId))
  const highUrgency = visibleSuggestions.filter(s => s.urgency === 'high')
  const totalSavings = visibleSuggestions.reduce((sum, s) => sum + Math.abs(s.priceChange), 0)

  const handleApply = async (suggestion: RepricingSuggestion) => {
    setApplying(prev => new Set(prev).add(suggestion.itemId))
    try {
      await onApply(suggestion)
      setDismissed(prev => new Set(prev).add(suggestion.itemId))
      // Success feedback
      alert(`✅ Successfully repriced ${suggestion.sku} to ${format(suggestion.suggestedPrice)}`)
    } catch (error) {
      console.error('Failed to apply repricing:', error)
      // Error feedback
      alert(`❌ Failed to apply repricing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setApplying(prev => {
        const next = new Set(prev)
        next.delete(suggestion.itemId)
        return next
      })
    }
  }

  const handleDismiss = (itemId: string) => {
    setDismissed(prev => new Set(prev).add(itemId))
  }

  if (visibleSuggestions.length === 0) {
    return (
      <div className={cn('bg-elev-1 border border-border/40 rounded-xl p-6', className)}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#00FF94]/10 mb-4">
            <Check className="h-8 w-8 text-[#00FF94]" />
          </div>
          <h3 className="text-lg font-semibold text-fg mb-2">All Set!</h3>
          <p className="text-sm text-muted">
            No repricing suggestions at this time. Your pricing looks good.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-elev-1 border border-amber-500/40 rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="text-lg font-semibold text-fg">Smart Repricing Suggestions</h3>
            <p className="text-sm text-muted mt-0.5">
              AI-powered pricing to move inventory faster
            </p>
          </div>
        </div>
        {onApplyAll && visibleSuggestions.length > 1 && (
          <Button
            onClick={onApplyAll}
            size="sm"
            className="bg-[#00FF94] text-black hover:bg-[#00E085]"
          >
            Apply All ({visibleSuggestions.length})
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Suggestions</div>
          <div className="text-lg font-bold text-amber-400 mono">{visibleSuggestions.length}</div>
        </div>
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">High Priority</div>
          <div className="text-lg font-bold text-red-400 mono">{highUrgency.length}</div>
        </div>
        <div>
          <div className="text-xs text-dim uppercase tracking-wide mb-1">Avg Change</div>
          <div className="text-lg font-bold text-fg mono">
            -{(totalSavings / visibleSuggestions.length).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {visibleSuggestions.slice(0, 10).map((suggestion) => {
          const isApplying = applying.has(suggestion.itemId)

          return (
            <div
              key={suggestion.itemId}
              className={cn(
                'p-3 bg-elev-0 rounded-lg border transition-all',
                suggestion.urgency === 'high' && 'border-red-500/30',
                suggestion.urgency === 'medium' && 'border-amber-500/30',
                suggestion.urgency === 'low' && 'border-border/30'
              )}
            >
              {/* Product & Urgency */}
              <div className="flex items-start gap-3 mb-3">
                <ProductLineItem
                  imageUrl={suggestion.image_url || null}
                  imageAlt={`${suggestion.brand} ${suggestion.model}`}
                  brand={suggestion.brand || ''}
                  model={suggestion.model || ''}
                  variant={suggestion.colorway || undefined}
                  sku={suggestion.sku}
                  href={`/portfolio/inventory`}
                  sizeUk={suggestion.size_uk || undefined}
                  sizeSystem="UK"
                  category="sneakers"
                  className="flex-1"
                />
                <div className={cn(
                  'px-2 py-1 rounded-md text-xs font-semibold uppercase',
                  suggestion.urgency === 'high' && 'bg-red-500/10 text-red-400',
                  suggestion.urgency === 'medium' && 'bg-amber-500/10 text-amber-400',
                  suggestion.urgency === 'low' && 'bg-blue-500/10 text-blue-400'
                )}>
                  {suggestion.urgency}
                </div>
              </div>

              {/* Pricing Details */}
              <div className="grid grid-cols-3 gap-4 mb-3 p-2 bg-elev-1 rounded border border-border/20">
                <div>
                  <div className="text-xs text-dim mb-0.5">Current</div>
                  <div className="text-sm font-bold text-fg mono">{format(suggestion.currentPrice)}</div>
                </div>
                <div>
                  <div className="text-xs text-dim mb-0.5">Suggested</div>
                  <div className="text-sm font-bold text-[#00FF94] mono">{format(suggestion.suggestedPrice)}</div>
                </div>
                <div>
                  <div className="text-xs text-dim mb-0.5">Change</div>
                  <div className={cn(
                    'text-sm font-bold mono',
                    suggestion.priceChange < 0 ? 'text-red-400' : 'text-[#00FF94]'
                  )}>
                    {suggestion.priceChange < 0 ? '' : '+'}{format(suggestion.priceChange)}
                    <span className="text-xs ml-1">({suggestion.priceChangePercent.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              {/* Reason & Confidence */}
              <div className="flex items-start gap-2 mb-3 text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-0.5">
                        <Info className="h-4 w-4 text-muted" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <div className="font-semibold mb-1">Details</div>
                        <div>Days in inventory: {suggestion.daysInInventory}d</div>
                        <div>Expected margin: {suggestion.expectedMargin.toFixed(1)}%</div>
                        <div>Confidence: {suggestion.confidence}</div>
                        {suggestion.marketLowestAsk && (
                          <div>Market lowest ask: {format(suggestion.marketLowestAsk)}</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-muted flex-1">{suggestion.reason}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleApply(suggestion)}
                  disabled={isApplying}
                  size="sm"
                  className="flex-1 bg-[#00FF94] text-black hover:bg-[#00E085]"
                >
                  {isApplying ? (
                    <>Applying...</>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Apply Suggestion
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleDismiss(suggestion.itemId)}
                  disabled={isApplying}
                  size="sm"
                  variant="outline"
                  className="border-border/30"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}

        {visibleSuggestions.length > 10 && (
          <div className="text-center p-3 text-sm text-muted">
            +{visibleSuggestions.length - 10} more suggestions
          </div>
        )}
      </div>
    </div>
  )
}
