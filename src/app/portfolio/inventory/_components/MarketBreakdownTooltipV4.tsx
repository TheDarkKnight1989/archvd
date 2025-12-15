'use client'

/**
 * MarketBreakdownTooltipV4 - Detailed fee breakdown tooltip
 *
 * Shows a full breakdown of:
 * - StockX and Alias pricing
 * - Fee calculations (platform fee, payment processing, shipping)
 * - Net proceeds comparison
 * - Best platform recommendation with savings
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'
import type { ArchvdPriceWithFees, PlatformNetProceeds } from '@/lib/pricing-v4/types'

// =============================================================================
// TYPES
// =============================================================================

export interface MarketBreakdownTooltipV4Props {
  marketData: ArchvdPriceWithFees | null
  children: React.ReactNode
  /** Side of the tooltip (default: top) */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Alignment (default: center) */
  align?: 'start' | 'center' | 'end'
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number | null, currency: string): string {
  if (value === null) return '—'
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }
  const symbol = symbols[currency] || currency
  return `${symbol}${value.toFixed(2)}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

// =============================================================================
// FEE BREAKDOWN ROW
// =============================================================================

function FeeRow({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  if (value === null || value === 0) return null
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-white/50">{label}</span>
      <span className="text-white/70 tabular-nums">-{formatCurrency(value, currency)}</span>
    </div>
  )
}

// =============================================================================
// PLATFORM BREAKDOWN SECTION
// =============================================================================

function PlatformBreakdown({
  platform,
  data,
  isBest,
  userCurrency,
}: {
  platform: 'stockx' | 'alias'
  data: PlatformNetProceeds | null
  isBest: boolean
  userCurrency: string
}) {
  const platformName = platform === 'stockx' ? 'StockX' : 'Alias'
  const platformColor = platform === 'stockx' ? 'emerald' : 'blue'

  if (!data) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-medium',
              `text-${platformColor}-400/50`
            )}
          >
            {platformName}
          </span>
          <span className="text-[10px] text-white/30">No data</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-semibold',
              platform === 'stockx' ? 'text-emerald-400' : 'text-blue-400'
            )}
          >
            {platformName}
          </span>
          {isBest && (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              BEST
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-white tabular-nums">
          {formatCurrency(data.netReceiveUserCurrency, userCurrency)}
        </span>
      </div>

      {/* Gross price */}
      <div className="flex justify-between text-[11px]">
        <span className="text-white/50">Sale price</span>
        <span className="text-white/70 tabular-nums">
          {formatCurrency(data.grossPrice, data.grossPriceCurrency)}
        </span>
      </div>

      {/* Fee breakdown */}
      <div className="space-y-0.5 pl-2 border-l border-white/10">
        <FeeRow label="Platform fee" value={data.fees.platformFee} currency={data.grossPriceCurrency} />
        <FeeRow label="Payment fee" value={data.fees.paymentFee} currency={data.grossPriceCurrency} />
        <FeeRow label="Shipping" value={data.fees.shipping} currency={data.grossPriceCurrency} />
      </div>

      {/* Total fees */}
      <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
        <span className="text-white/50">Total fees</span>
        <span className="text-red-400/80 tabular-nums">
          -{formatCurrency(data.fees.total, data.grossPriceCurrency)}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MarketBreakdownTooltipV4({
  marketData,
  children,
  side = 'top',
  align = 'center',
}: MarketBreakdownTooltipV4Props) {
  // No tooltip if no data
  if (!marketData) {
    return <>{children}</>
  }

  const { netProceeds, bestPlatformToSell, platformAdvantage, realProfit, realProfitPercent, currency } = marketData
  const hasStockx = netProceeds.stockx !== null
  const hasAlias = netProceeds.alias !== null

  // No tooltip if no platform data
  if (!hasStockx && !hasAlias) {
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="w-72 p-0 bg-[#1a1a1a] border-white/10"
        >
          <div className="p-3 space-y-4">
            {/* Header */}
            <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Fee Breakdown
            </div>

            {/* StockX Section */}
            {hasStockx && (
              <PlatformBreakdown
                platform="stockx"
                data={netProceeds.stockx}
                isBest={bestPlatformToSell === 'stockx'}
                userCurrency={currency}
              />
            )}

            {/* Divider */}
            {hasStockx && hasAlias && (
              <div className="border-t border-white/10" />
            )}

            {/* Alias Section */}
            {hasAlias && (
              <PlatformBreakdown
                platform="alias"
                data={netProceeds.alias}
                isBest={bestPlatformToSell === 'alias'}
                userCurrency={currency}
              />
            )}

            {/* Recommendation */}
            {bestPlatformToSell && platformAdvantage !== null && platformAdvantage > 0 && (
              <>
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">
                    {bestPlatformToSell === 'stockx' ? 'StockX' : 'Alias'} saves you
                  </span>
                  <span className="text-xs font-medium text-emerald-400 tabular-nums">
                    +{formatCurrency(platformAdvantage, currency)}
                  </span>
                </div>
              </>
            )}

            {/* Profit summary */}
            {realProfit !== null && (
              <>
                <div className="border-t border-white/10" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">Real profit</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        realProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {realProfit >= 0 ? '+' : ''}{formatCurrency(realProfit, currency)}
                    </span>
                    {realProfitPercent !== null && (
                      <span
                        className={cn(
                          'text-[10px] tabular-nums',
                          realProfit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
                        )}
                      >
                        ({realProfit >= 0 ? '+' : ''}{realProfitPercent.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
