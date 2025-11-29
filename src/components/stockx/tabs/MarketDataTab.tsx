'use client'

/**
 * Market Data Tab
 *
 * Displays comprehensive market analytics including:
 * - Price trends (7d/30d median)
 * - Current market stats (Lowest Ask, Highest Bid, Spread)
 * - Sales activity (last 72 hours)
 * - Market position indicators
 */

import { useState } from 'react'
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface MarketDataTabProps {
  item: any // Same item prop from parent modal
  currency: string
}

export function MarketDataTab({ item, currency }: MarketDataTabProps) {
  const [timeframe, setTimeframe] = useState<'7d' | '30d'>('7d')

  // Extract market data
  const lowestAsk = item.market?.price || item.stockx?.lowestAsk || null
  const highestBid = item.market?.highestBid || item.stockx?.highestBid || null
  const lastSale = item.stockx?.lastSale || null
  const salesLast72h = item.stockx?.salesLast72h || 0

  // Calculate spread
  const spread = lowestAsk && highestBid ? lowestAsk - highestBid : null
  const spreadPercentage = lowestAsk && spread ? (spread / lowestAsk) * 100 : null

  // Format currency
  const formatPrice = (amount: number | null): string => {
    if (amount === null) return 'N/A'
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
    return `${symbol}${amount.toFixed(0)}`
  }

  // Determine trend (for now, use simple logic - can be enhanced with actual historical data)
  const trend = lastSale && lowestAsk ? (lowestAsk > lastSale ? 'up' : 'down') : null

  return (
    <div className="space-y-6">
      {/* Price Trend Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">Price Trend</h3>

          {/* Timeframe Toggle */}
          <div className="flex items-center gap-1 p-1 bg-soft/50 rounded-lg border border-border">
            <button
              onClick={() => setTimeframe('7d')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-all duration-120',
                timeframe === '7d'
                  ? 'bg-[#00FF94] text-black'
                  : 'text-muted hover:text-fg'
              )}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('30d')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-all duration-120',
                timeframe === '30d'
                  ? 'bg-[#00FF94] text-black'
                  : 'text-muted hover:text-fg'
              )}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Simple Chart Placeholder */}
        <div className="h-[180px] rounded-lg border border-border bg-soft/30 flex items-center justify-center">
          <div className="text-center">
            <Activity className="h-8 w-8 text-muted mx-auto mb-2" />
            <p className="text-sm text-muted">
              Price chart coming soon
            </p>
            <p className="text-xs text-muted mt-1">
              Historical data for {timeframe} timeframe
            </p>
          </div>
        </div>
      </div>

      {/* Market Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Lowest Ask */}
        <div className="rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10 border-2 border-red-500/40 shadow-lg shadow-red-500/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wide">
              Lowest Ask
            </span>
            {trend === 'up' && (
              <TrendingUp className="h-4 w-4 text-accent" />
            )}
          </div>
          <div className="text-2xl font-bold text-red-400 mono">
            {formatPrice(lowestAsk)}
          </div>
          {lastSale && lowestAsk && (
            <div className="text-xs text-muted mt-1 font-medium">
              {lowestAsk > lastSale ? '+' : ''}{((lowestAsk - lastSale) / lastSale * 100).toFixed(1)}% vs last sale
            </div>
          )}
        </div>

        {/* Highest Bid */}
        <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wide">
              Highest Bid
            </span>
            {trend === 'down' && (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </div>
          <div className="text-2xl font-bold text-emerald-400 mono">
            {formatPrice(highestBid)}
          </div>
          {lastSale && highestBid && (
            <div className="text-xs text-muted mt-1 font-medium">
              {highestBid > lastSale ? '+' : ''}{((highestBid - lastSale) / lastSale * 100).toFixed(1)}% vs last sale
            </div>
          )}
        </div>

        {/* Spread */}
        <div className="rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border-2 border-accent/40 shadow-lg shadow-accent/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wide">
              Spread
            </span>
            <DollarSign className="h-4 w-4 text-accent" />
          </div>
          <div className="text-2xl font-bold text-accent mono">
            {spread !== null ? formatPrice(spread) : 'N/A'}
          </div>
          {spreadPercentage !== null && (
            <div className="text-xs text-muted mt-1 font-medium">
              {spreadPercentage.toFixed(1)}% of ask price
            </div>
          )}
        </div>

        {/* Sales Last 72h */}
        <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-2 border-blue-500/40 shadow-lg shadow-blue-500/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wide">
              Sales (72h)
            </span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mono">
            {salesLast72h}
          </div>
          {salesLast72h > 0 && lastSale && (
            <div className="text-xs text-muted mt-1 font-medium">
              Avg: {formatPrice(lastSale)}
            </div>
          )}
        </div>
      </div>

      {/* Market Insights */}
      <div className="rounded-xl bg-gradient-to-br from-elev-1 to-elev-1/80 border-2 border-accent/20 shadow-lg p-4">
        <h4 className="text-sm font-bold text-fg mb-3 uppercase tracking-wide">Market Insights</h4>
        <div className="space-y-2">
          {/* Liquidity Indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted font-medium">Market Liquidity:</span>
            <span className={cn(
              'font-bold',
              salesLast72h > 10 ? 'text-accent' : salesLast72h > 5 ? 'text-amber-400' : 'text-red-400'
            )}>
              {salesLast72h > 10 ? 'High' : salesLast72h > 5 ? 'Medium' : 'Low'}
            </span>
          </div>

          {/* Spread Indicator */}
          {spreadPercentage !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted font-medium">Price Gap:</span>
              <span className={cn(
                'font-bold',
                spreadPercentage < 5 ? 'text-accent' : spreadPercentage < 10 ? 'text-amber-400' : 'text-red-400'
              )}>
                {spreadPercentage < 5 ? 'Tight' : spreadPercentage < 10 ? 'Moderate' : 'Wide'}
              </span>
            </div>
          )}

          {/* Last Sale */}
          {lastSale && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted font-medium">Last Sale:</span>
              <span className="font-bold mono text-fg">
                {formatPrice(lastSale)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Educational Note */}
      <div className="rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border-2 border-accent/40 shadow-lg shadow-accent/10 p-4">
        <p className="text-xs text-fg leading-relaxed">
          <span className="font-bold text-accent">Tip:</span> List below the Lowest Ask to increase visibility,
          or match the Highest Bid for instant sale (minus StockX fees).
        </p>
      </div>
    </div>
  )
}
