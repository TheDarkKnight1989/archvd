'use client'

/**
 * UnifiedMarketSection - V4 Unified Market Data Display
 *
 * Uses the new unified market data service (inventory_v4 tables).
 * Displayed alongside existing market data for comparison during testing.
 *
 * Features:
 * - Fetches from v4 unified market function
 * - Shows both StockX and Alias prices
 * - Currency toggle: Native | GBP | USD
 * - FX conversion for accurate price comparison
 * - Highlights best price across providers (normalized)
 */

import { useState } from 'react'
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatMoney } from '@/lib/format/money'
import { useUnifiedMarketData } from '@/hooks/useUnifiedMarketData'
import { useCurrency, type Currency } from '@/hooks/useCurrency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AliasRegion } from '@/lib/services/unified-market'
import type { UnifiedMarketRow } from '@/lib/services/unified-market'

// Display currency mode
type DisplayCurrency = 'native' | 'GBP' | 'USD'

interface UnifiedMarketSectionProps {
  sku: string | null
  userSizeUS?: number | null
}

/**
 * Convert a price to the target display currency
 * Returns null if amount is null, original amount if native mode
 */
function getDisplayPrice(
  amount: number | null,
  sourceCurrency: string | null,
  targetCurrency: DisplayCurrency,
  convert: (amount: number, from: Currency, to: Currency) => number
): number | null {
  if (amount == null) return null

  if (targetCurrency === 'native') {
    // Just return the raw number - consumer will show sourceCurrency
    return amount
  }

  const from = (sourceCurrency || 'GBP') as Currency
  return convert(amount, from, targetCurrency as Currency)
}

/**
 * Find best ask price across providers, comparing in a common currency (GBP)
 * Returns the provider and original (unconverted) price
 */
function findBestAskNormalized(
  row: UnifiedMarketRow,
  convert: (amount: number, from: Currency, to: Currency) => number
): { provider: 'stockx' | 'alias' | null; price: number | null } {
  const sx = row.stockx_lowest_ask
  const al = row.alias_lowest_ask

  if (sx == null && al == null) return { provider: null, price: null }

  const sxCurrency = (row.stockx_currency || 'GBP') as Currency
  const alCurrency = (row.alias_currency || 'USD') as Currency

  // Compare in GBP as baseline
  const target: Currency = 'GBP'

  const sxInTarget = sx != null ? convert(sx, sxCurrency, target) : null
  const alInTarget = al != null ? convert(al, alCurrency, target) : null

  if (sxInTarget == null) return { provider: 'alias', price: al! }
  if (alInTarget == null) return { provider: 'stockx', price: sx! }

  return sxInTarget <= alInTarget
    ? { provider: 'stockx', price: sx! }
    : { provider: 'alias', price: al! }
}

/**
 * Find best bid price across providers, comparing in a common currency (GBP)
 * Returns the provider and original (unconverted) price
 */
function findBestBidNormalized(
  row: UnifiedMarketRow,
  convert: (amount: number, from: Currency, to: Currency) => number
): { provider: 'stockx' | 'alias' | null; price: number | null } {
  const sx = row.stockx_highest_bid
  const al = row.alias_highest_bid

  if (sx == null && al == null) return { provider: null, price: null }

  const sxCurrency = (row.stockx_currency || 'GBP') as Currency
  const alCurrency = (row.alias_currency || 'USD') as Currency

  // Compare in GBP as baseline
  const target: Currency = 'GBP'

  const sxInTarget = sx != null ? convert(sx, sxCurrency, target) : null
  const alInTarget = al != null ? convert(al, alCurrency, target) : null

  if (sxInTarget == null) return { provider: 'alias', price: al! }
  if (alInTarget == null) return { provider: 'stockx', price: sx! }

  // For bids, higher is better for seller
  return sxInTarget >= alInTarget
    ? { provider: 'stockx', price: sx! }
    : { provider: 'alias', price: al! }
}

export function UnifiedMarketSection({ sku, userSizeUS }: UnifiedMarketSectionProps) {
  const [region, setRegion] = useState<AliasRegion>('1')
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('native')

  const { data, loading, error, refetch } = useUnifiedMarketData({
    styleId: sku,
    aliasRegion: region,
    consigned: false,
    enabled: !!sku,
    useDirect: false,
  })

  const { convert, fxRates, loading: fxLoading } = useCurrency()

  // Stats
  const totalSizes = data?.length ?? 0
  const bothProviders = data?.filter((r) => r.has_stockx && r.has_alias).length ?? 0
  const stockxOnly = data?.filter((r) => r.has_stockx && !r.has_alias).length ?? 0
  const aliasOnly = data?.filter((r) => !r.has_stockx && r.has_alias).length ?? 0

  if (!sku) {
    return null
  }

  return (
    <div className="rounded-2xl border border-dashed border-accent/50 bg-accent/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-accent/20">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-semibold text-fg tracking-tight">
            Unified Market Data (V4)
          </h3>
          <Badge variant="outline" className="text-xs bg-accent/10 border-accent/30 text-accent">
            Testing
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {/* Currency toggle */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">Show in:</span>
            {(['native', 'GBP', 'USD'] as DisplayCurrency[]).map((c) => (
              <button
                key={c}
                onClick={() => setDisplayCurrency(c)}
                disabled={fxLoading}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  displayCurrency === c
                    ? 'bg-accent text-white'
                    : 'bg-soft text-muted hover:bg-soft/80',
                  fxLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {c === 'native' ? 'Native' : c}
              </button>
            ))}
          </div>

          {/* Region selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">Region:</span>
            {(['1', '2', '3'] as AliasRegion[]).map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors',
                  region === r
                    ? 'bg-accent text-white'
                    : 'bg-soft text-muted hover:bg-soft/80'
                )}
              >
                {r === '1' ? 'UK' : r === '2' ? 'EU' : 'US'}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="h-8 px-2"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-6 py-2 bg-accent/5 border-b border-accent/10 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>SKU: <code className="font-mono text-fg">{sku}</code></span>
          <span>|</span>
          <span>Total: <strong className="text-fg">{totalSizes}</strong> sizes</span>
          <span>|</span>
          <span className="text-green-600">Both: {bothProviders}</span>
          <span className="text-yellow-600">SX only: {stockxOnly}</span>
          <span className="text-blue-600">Alias only: {aliasOnly}</span>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error.message}</span>
          </div>
        )}

        {!error && data && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>RPC working</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="px-6 py-8 text-center text-muted">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading unified market data...</p>
        </div>
      ) : error ? (
        <div className="px-6 py-8 text-center">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-500 mb-2">Failed to load unified data</p>
          <p className="text-xs text-muted">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      ) : data && data.length > 0 ? (
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-panel border-b border-keyline z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">
                  Size
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted uppercase tracking-wide">
                  StockX Ask {displayCurrency !== 'native' && <span className="text-accent">({displayCurrency})</span>}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted uppercase tracking-wide">
                  StockX Bid {displayCurrency !== 'native' && <span className="text-accent">({displayCurrency})</span>}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted uppercase tracking-wide">
                  Alias Ask {displayCurrency !== 'native' && <span className="text-accent">({displayCurrency})</span>}
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted uppercase tracking-wide">
                  Alias Bid {displayCurrency !== 'native' && <span className="text-accent">({displayCurrency})</span>}
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-muted uppercase tracking-wide">
                  Best Ask
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.map((row, idx) => {
                const isUserSize = userSizeUS && row.size_numeric === userSizeUS
                const bestAsk = findBestAskNormalized(row, convert)

                // Get display prices
                const stockxAskDisplay = getDisplayPrice(
                  row.stockx_lowest_ask,
                  row.stockx_currency,
                  displayCurrency,
                  convert
                )
                const stockxBidDisplay = getDisplayPrice(
                  row.stockx_highest_bid,
                  row.stockx_currency,
                  displayCurrency,
                  convert
                )
                const aliasAskDisplay = getDisplayPrice(
                  row.alias_lowest_ask,
                  row.alias_currency,
                  displayCurrency,
                  convert
                )
                const aliasBidDisplay = getDisplayPrice(
                  row.alias_highest_bid,
                  row.alias_currency,
                  displayCurrency,
                  convert
                )

                // Determine which currency to show for formatting
                const stockxCurrencyToShow =
                  displayCurrency === 'native'
                    ? (row.stockx_currency || 'GBP')
                    : displayCurrency
                const aliasCurrencyToShow =
                  displayCurrency === 'native'
                    ? (row.alias_currency || 'USD')
                    : displayCurrency

                return (
                  <tr
                    key={row.size_display}
                    className={cn(
                      'transition-colors',
                      idx % 2 === 0 ? 'bg-table-zebra' : 'bg-panel',
                      isUserSize && 'bg-accent/10 ring-1 ring-inset ring-accent/20'
                    )}
                  >
                    {/* Size */}
                    <td className="px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium', isUserSize && 'text-accent')}>
                          {row.size_display}
                        </span>
                        {isUserSize && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            You
                          </Badge>
                        )}
                        {row.has_stockx && row.has_alias && (
                          <span className="text-[10px] text-green-600">BOTH</span>
                        )}
                      </div>
                    </td>

                    {/* StockX Ask */}
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'mono text-sm',
                        stockxAskDisplay != null ? 'text-yellow-600' : 'text-muted'
                      )}>
                        {stockxAskDisplay != null
                          ? formatMoney(stockxAskDisplay, stockxCurrencyToShow)
                          : '—'}
                      </span>
                    </td>

                    {/* StockX Bid */}
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'mono text-sm',
                        stockxBidDisplay != null ? 'text-fg' : 'text-muted'
                      )}>
                        {stockxBidDisplay != null
                          ? formatMoney(stockxBidDisplay, stockxCurrencyToShow)
                          : '—'}
                      </span>
                    </td>

                    {/* Alias Ask */}
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'mono text-sm',
                        aliasAskDisplay != null ? 'text-blue-600' : 'text-muted'
                      )}>
                        {aliasAskDisplay != null
                          ? formatMoney(aliasAskDisplay, aliasCurrencyToShow)
                          : '—'}
                      </span>
                    </td>

                    {/* Alias Bid */}
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'mono text-sm',
                        aliasBidDisplay != null ? 'text-fg' : 'text-muted'
                      )}>
                        {aliasBidDisplay != null
                          ? formatMoney(aliasBidDisplay, aliasCurrencyToShow)
                          : '—'}
                      </span>
                    </td>

                    {/* Best Ask indicator (based on normalized comparison) */}
                    <td className="px-4 py-2.5 text-center">
                      {bestAsk.provider ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-5',
                            bestAsk.provider === 'stockx'
                              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-600'
                          )}
                        >
                          {bestAsk.provider === 'stockx' ? 'SX' : 'AL'}
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-muted">
          <p className="text-sm">No unified market data found for this SKU</p>
          <p className="text-xs mt-1">SKU may not be in inventory_v4_style_catalog</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 border-t border-accent/20 bg-accent/5">
        <p className="text-xs text-muted">
          {displayCurrency !== 'native' && fxRates && (
            <>
              <span className="text-accent">FX:</span> 1 GBP = {fxRates.usd_per_gbp.toFixed(4)} USD | {' '}
            </>
          )}
          Data from <code className="text-accent">inventory_v4_*</code> tables via <code className="text-accent">get_unified_market_data()</code> RPC
          {' '}| Region: {region === '1' ? 'UK' : region === '2' ? 'EU' : 'US'}
          {displayCurrency === 'native' && ' | StockX: GBP | Alias: USD'}
        </p>
      </div>
    </div>
  )
}
