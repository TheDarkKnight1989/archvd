'use client'

/**
 * MarketPageV4 - Main market page component
 *
 * Mobile-first design with desktop enhancements
 * Uses only V4 data sources
 */

import Image from 'next/image'
import { useMarketPageData } from '@/hooks/useMarketPageData'
import { KeyStatsRow } from './KeyStatsRow'
import { TimeRangeToggle } from './TimeRangeToggle'
import { SalesPriceChart } from './SalesPriceChart'
import { ChartSummary } from './ChartSummary'
import { LiquidityCard } from './LiquidityCard'
import { PriceGrid } from './PriceGrid'

interface MarketPageV4Props {
  styleId: string
  initialImageUrl?: string | null
  initialName?: string | null
  initialBrand?: string | null
}

export function MarketPageV4({
  styleId,
  initialImageUrl,
  initialName,
  initialBrand,
}: MarketPageV4Props) {
  const {
    product,
    productLoading,
    keyStats,
    keyStatsLoading,
    chartData,
    chartRange,
    setChartRange,
    chartLoading,
    chartSummary,
    liquidity,
    liquidityLoading,
    sizeGrid,
    sizeGridLoading,
    sizeGridTab,
    setSizeGridTab,
  } = useMarketPageData({
    styleId,
    aliasRegion: '1', // UK default
    enabled: true,
  })

  // Use initial values or fetched values
  const displayName = product?.name || initialName || styleId
  const displayBrand = product?.brand || initialBrand || ''
  const displayImage = product?.imageUrl || initialImageUrl

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile: Stacked layout */}
      {/* Desktop: Side-by-side layout */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Product Hero - Mobile optimized */}
        <div className="flex flex-col lg:flex-row lg:gap-8 mb-6">
          {/* Image */}
          <div className="w-full lg:w-72 aspect-square bg-muted rounded-xl overflow-hidden flex-shrink-0 mb-4 lg:mb-0">
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
                {productLoading ? (
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'No image'
                )}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1">
            {displayBrand && (
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                {displayBrand}
              </p>
            )}
            <h1 className="text-xl lg:text-2xl font-bold mt-1">{displayName}</h1>
            {product?.colorway && (
              <p className="text-muted-foreground text-sm mt-1">{product.colorway}</p>
            )}
            <p className="font-mono text-sm mt-2 text-muted-foreground">
              SKU: {styleId}
            </p>

            {/* Key Stats - Desktop only (inline) */}
            <div className="hidden lg:block mt-6">
              <KeyStatsRow stats={keyStats} loading={keyStatsLoading} currencySymbol="$" />
            </div>
          </div>
        </div>

        {/* Key Stats - Mobile only */}
        <div className="lg:hidden mb-6">
          <KeyStatsRow stats={keyStats} loading={keyStatsLoading} currencySymbol="$" />
        </div>

        {/* Chart Section */}
        <div className="space-y-4">
          {/* Time Range Toggle */}
          <div className="flex items-center justify-between">
            <TimeRangeToggle
              value={chartRange}
              onChange={setChartRange}
              disabled={chartLoading}
            />
          </div>

          {/* Chart + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart - Full width on mobile, 2/3 on desktop */}
            <div className="lg:col-span-2">
              <SalesPriceChart
                data={chartData}
                range={chartRange}
                loading={chartLoading}
                currencySymbol="$"
              />

              {/* Summary - Below chart on mobile */}
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <ChartSummary
                  summary={chartSummary}
                  loading={chartLoading}
                  currencySymbol="$"
                />
              </div>
            </div>

            {/* Liquidity - Desktop sidebar */}
            <div className="hidden lg:block">
              <LiquidityCard data={liquidity} loading={liquidityLoading} />
            </div>
          </div>

          {/* Liquidity - Mobile (below chart) */}
          <div className="lg:hidden">
            <LiquidityCard data={liquidity} loading={liquidityLoading} />
          </div>
        </div>

        {/* Price Grid (Asks/Bids/Sales tabs) */}
        <div className="mt-8">
          <PriceGrid
            data={sizeGrid}
            loading={sizeGridLoading}
            activeTab={sizeGridTab}
            onTabChange={setSizeGridTab}
            currencySymbol="$"
          />
        </div>
      </div>
    </div>
  )
}
