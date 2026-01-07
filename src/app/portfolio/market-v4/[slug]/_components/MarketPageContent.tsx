'use client'

/**
 * V4 Market Page Content - Client Component
 *
 * Handles:
 * 1. Style resolution for unknown SKUs (calls /api/v4/style/resolve)
 * 2. Sync status polling while data loads
 * 3. Unified market data display
 *
 * V4 Tables Used (via hooks/services):
 * - inventory_v4_style_catalog
 * - inventory_v4_sync_queue
 * - inventory_v4_*_market_data (via useUnifiedMarketData)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useUnifiedMarketData } from '@/hooks/useUnifiedMarketData'
import { useV4SalesHistory } from '@/hooks/useV4SalesHistory'
import { useCurrency, type Currency } from '@/hooks/useCurrency'
import type { AliasRegion } from '@/lib/services/unified-market'
import { SalesChart } from './SalesChart'
import { LiquidityModule } from './LiquidityModule'

// Map region to display currency
const REGION_CURRENCY: Record<AliasRegion, Currency> = {
  '1': 'GBP', // UK
  '2': 'EUR', // EU
  '3': 'USD', // US
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
}

// Props from server component
export interface MarketPageContentProps {
  styleId: string
  slug: string
  initialStyle: {
    style_id: string
    name: string | null
    brand: string | null
    colorway: string | null
    primary_image_url: string | null
    stockx_product_id: string | null
    alias_catalog_id: string | null
    created_at: string
    last_synced_at: string | null
  } | null
  externalIds: {
    aliasCatalogId: string | null
    stockxProductId: string | null
    stockxUrlKey: string | null
  }
  productMeta: {
    name: string | null
    brand: string | null
    colorway: string | null
    imageUrl: string | null
  }
}

type ResolveState = 'idle' | 'resolving' | 'resolved' | 'error'

export function MarketPageContent({
  styleId,
  initialStyle,
  externalIds,
  productMeta,
}: MarketPageContentProps) {
  // State
  const [style, setStyle] = useState(initialStyle)
  const [resolveState, setResolveState] = useState<ResolveState>(
    initialStyle ? 'resolved' : 'idle'
  )
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [aliasRegion, setAliasRegion] = useState<AliasRegion>('1') // Default UK

  // Resolve style if not found on server
  const resolveStyle = useCallback(async () => {
    if (style || resolveState === 'resolving') return

    setResolveState('resolving')
    setResolveError(null)

    try {
      const response = await fetch('/api/v4/style/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleId,
          externalIds: {
            aliasCatalogId: externalIds.aliasCatalogId,
            stockxProductId: externalIds.stockxProductId,
            stockxUrlKey: externalIds.stockxUrlKey,
          },
          name: productMeta.name,
          brand: productMeta.brand,
          colorway: productMeta.colorway,
          imageUrl: productMeta.imageUrl,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to resolve style')
      }

      const data = await response.json()
      setStyle(data.style)
      setResolveState('resolved')
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Unknown error')
      setResolveState('error')
    }
  }, [styleId, style, resolveState, externalIds, productMeta])

  // Auto-resolve on mount if no initial style
  useEffect(() => {
    if (!initialStyle && resolveState === 'idle') {
      resolveStyle()
    }
  }, [initialStyle, resolveState, resolveStyle])

  // Currency conversion
  const { convert, fxRates } = useCurrency()
  const displayCurrency = REGION_CURRENCY[aliasRegion]
  const displaySymbol = CURRENCY_SYMBOLS[displayCurrency]

  // Unified market data
  const {
    data: marketData,
    loading: marketLoading,
    error: marketError,
    refetch: refetchMarket,
  } = useUnifiedMarketData({
    styleId: style?.style_id ?? null,
    aliasRegion,
    enabled: !!style,
    useDirect: true, // Use direct query (RPC may not be deployed)
  })

  // Sales history (V4 retention tables)
  const {
    rawSalesChart,
    dailySalesChart,
    monthlySalesChart,
    liquidity,
    rawSalesLoading,
    dailySalesLoading,
    monthlySalesLoading,
    rawSalesError,
  } = useV4SalesHistory({
    styleId: style?.style_id ?? null,
    enabled: !!style,
  })

  // Convert prices to display currency
  const convertedMarketData = useMemo(() => {
    if (!marketData || !fxRates) return marketData

    return marketData.map((row) => {
      // Determine source currencies
      const stockxCurrency = (row.stockx_currency || 'GBP') as Currency
      const aliasCurrency = 'USD' as Currency // Alias is always USD

      // Convert StockX prices
      const sxAsk = row.stockx_lowest_ask != null
        ? convert(row.stockx_lowest_ask, stockxCurrency, displayCurrency)
        : null
      const sxBid = row.stockx_highest_bid != null
        ? convert(row.stockx_highest_bid, stockxCurrency, displayCurrency)
        : null
      const sxEarnMore = row.stockx_earn_more != null
        ? convert(row.stockx_earn_more, stockxCurrency, displayCurrency)
        : null

      // Convert Alias prices
      const alAsk = row.alias_lowest_ask != null
        ? convert(row.alias_lowest_ask, aliasCurrency, displayCurrency)
        : null
      const alBid = row.alias_highest_bid != null
        ? convert(row.alias_highest_bid, aliasCurrency, displayCurrency)
        : null
      const alLastSale = row.alias_last_sale != null
        ? convert(row.alias_last_sale, aliasCurrency, displayCurrency)
        : null

      return {
        ...row,
        // Converted values
        stockx_lowest_ask_display: sxAsk,
        stockx_highest_bid_display: sxBid,
        stockx_earn_more_display: sxEarnMore,
        alias_lowest_ask_display: alAsk,
        alias_highest_bid_display: alBid,
        alias_last_sale_display: alLastSale,
      }
    })
  }, [marketData, fxRates, convert, displayCurrency])

  // Display values
  const displayName = style?.name || productMeta.name || styleId
  const displayBrand = style?.brand || productMeta.brand || ''
  const displayColorway = style?.colorway || productMeta.colorway || ''
  const displayImage = style?.primary_image_url || productMeta.imageUrl

  // Sync status indicator
  const hasStockxLink = !!(style?.stockx_product_id)
  const hasAliasLink = !!(style?.alias_catalog_id)
  const isSyncing = style && (!hasStockxLink && !hasAliasLink) && resolveState === 'resolved'

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Resolve Error */}
      {resolveState === 'error' && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-500">Failed to load product: {resolveError}</p>
          <button
            onClick={resolveStyle}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Product Hero */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Image */}
        <div className="w-full md:w-80 aspect-square bg-muted rounded-lg overflow-hidden flex-shrink-0">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={displayName}
              width={320}
              height={320}
              className="w-full h-full object-contain"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {resolveState === 'resolving' ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                'No image'
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">
            {displayBrand}
          </p>
          <h1 className="text-2xl font-bold mt-1">{displayName}</h1>
          {displayColorway && (
            <p className="text-muted-foreground mt-1">{displayColorway}</p>
          )}
          <p className="font-mono text-sm mt-2 text-muted-foreground">
            SKU: {styleId}
          </p>

          {/* Sync Status */}
          {resolveState === 'resolving' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating product entry...
            </div>
          )}
          {isSyncing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-500">
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Syncing market data...
            </div>
          )}

          {/* Provider Links */}
          {style && (
            <div className="mt-4 flex gap-4 text-xs">
              <span className={hasStockxLink ? 'text-green-500' : 'text-muted-foreground'}>
                StockX: {hasStockxLink ? 'Linked' : 'Pending'}
              </span>
              <span className={hasAliasLink ? 'text-green-500' : 'text-muted-foreground'}>
                Alias: {hasAliasLink ? 'Linked' : 'Pending'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Region Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Region:</span>
        <div className="flex gap-1">
          {(['1', '2', '3'] as AliasRegion[]).map((region) => (
            <button
              key={region}
              onClick={() => setAliasRegion(region)}
              className={`px-3 py-1 text-sm rounded ${
                aliasRegion === region
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {region === '1' ? 'UK' : region === '2' ? 'EU' : 'US'}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetchMarket()}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {/* Market Data Table - Shows sizes with data from either provider */}
      <div className="border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-3 text-left font-medium" rowSpan={2}>Size</th>
              <th className="px-3 py-2 text-center font-medium text-emerald-600 border-b border-emerald-200" colSpan={3}>StockX</th>
              <th className="px-3 py-2 text-center font-medium text-blue-600 border-b border-blue-200" colSpan={4}>Alias</th>
            </tr>
            <tr>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Ask</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Bid</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Payout</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Ask</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Bid</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Last Sale</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Payout</th>
            </tr>
          </thead>
          <tbody>
            {marketLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading market data...
                  </div>
                </td>
              </tr>
            )}
            {marketError && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-red-500">
                  Error loading market data: {marketError.message}
                </td>
              </tr>
            )}
            {!marketLoading && !marketError && (!convertedMarketData || convertedMarketData.filter(r => r.has_stockx || r.has_alias).length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  {style ? 'No market data available yet. Sync may be in progress.' : 'Waiting for product to be resolved...'}
                </td>
              </tr>
            )}
            {convertedMarketData?.filter(row => row.has_stockx || row.has_alias).map((row) => {
              // StockX payout: Use API value if available, else estimate (bid * 0.88 - £4 equiv)
              const sxPayout = row.stockx_earn_more_display ?? (row.stockx_highest_bid_display != null
                ? Math.round(row.stockx_highest_bid_display * 0.88 - (displayCurrency === 'GBP' ? 4 : displayCurrency === 'EUR' ? 5 : 5))
                : null)
              // Alias payout: bid - 9.5% commission - 2.9% payment - $2 shipping (converted)
              const shippingFee = displayCurrency === 'GBP' ? 1.6 : displayCurrency === 'EUR' ? 1.8 : 2
              const aliasPayout = row.alias_highest_bid_display != null
                ? Math.round(row.alias_highest_bid_display * 0.876 - shippingFee)
                : null

              return (
                <tr key={row.size_display} className="border-t hover:bg-muted/50">
                  <td className="px-3 py-2.5 font-medium">{row.size_display}</td>
                  {/* StockX columns */}
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {row.stockx_lowest_ask_display != null ? (
                      <span>{displaySymbol}{Math.round(row.stockx_lowest_ask_display)}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {row.stockx_highest_bid_display != null ? (
                      <span>{displaySymbol}{Math.round(row.stockx_highest_bid_display)}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {sxPayout != null ? (
                      <span className={row.stockx_earn_more_display != null ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {row.stockx_earn_more_display == null && '~'}{displaySymbol}{sxPayout}
                      </span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  {/* Alias columns */}
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {row.alias_lowest_ask_display != null ? (
                      <span>{displaySymbol}{Math.round(row.alias_lowest_ask_display)}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {row.alias_highest_bid_display != null ? (
                      <span>{displaySymbol}{Math.round(row.alias_highest_bid_display)}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {row.alias_last_sale_display != null ? (
                      <span className="text-muted-foreground">{displaySymbol}{Math.round(row.alias_last_sale_display)}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm">
                    {aliasPayout != null ? (
                      <span className="text-blue-600">~{displaySymbol}{aliasPayout}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Sales History Section */}
      {style && (
        <div className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold">Sales History</h2>

          {/* Liquidity + 90D Chart Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <LiquidityModule
                data={liquidity}
                loading={rawSalesLoading}
                error={rawSalesError}
              />
            </div>
            <div className="lg:col-span-2">
              <SalesChart
                data={rawSalesChart}
                loading={rawSalesLoading}
                error={rawSalesError}
                title="Last 90 Days"
                dateFormat="day"
                currencySymbol="$"
              />
            </div>
          </div>

          {/* 13M Chart */}
          <SalesChart
            data={dailySalesChart}
            loading={dailySalesLoading}
            title="Last 13 Months (Daily)"
            dateFormat="day"
            currencySymbol="$"
          />

          {/* All-time Chart */}
          <SalesChart
            data={monthlySalesChart}
            loading={monthlySalesLoading}
            title="All-Time (Monthly)"
            dateFormat="month"
            currencySymbol="$"
          />
        </div>
      )}
    </div>
  )
}
