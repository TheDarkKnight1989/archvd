'use client'

/**
 * InventoryV4Table - 14-Column CSS Grid Layout
 *
 * Layout Strategy: CSS Grid with fixed template columns
 * - Product column is weighted (1fr) to fill available space
 * - Numeric columns have fixed widths for tight alignment
 * - Responsive: hides Volume + Days Held on tablet (<1200px)
 *
 * Columns:
 * 1. ☑️  - bulk selection (44px)
 * 2. Product - image + name + colorway (minmax(280px, 1fr))
 * 3. Size - size with unit (56px)
 * 4. SKU - style ID (96px)
 * 5. Purchase Price - cost basis (88px)
 * 6. Lowest Asks - StockX vs Alias asks (104px)
 * 7. Spread - bid-ask spread % (60px)
 * 8. Instant Payout - NET at highest bid (112px)
 * 9. Instant P/L - profit/loss at instant sell (112px)
 * 10. Last Sale - most recent sale price (80px)
 * 11. 72h/30d - sales volume (72px) - hidden on tablet
 * 12. Listed - active listings (104px)
 * 13. Days Held - time since purchase (64px) - hidden on tablet
 * 14. ⋮ - actions menu (48px)
 */

import React, { useMemo, useRef } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils/cn'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
// NOTE: Using CSS Grid layout instead of TableBase for predictable column widths
import {
  ArrowUpDown,
  Info,
} from 'lucide-react'
import type { InventoryV4ItemFull, InventoryV4Listing } from '@/lib/inventory-v4/types'
import { PlatformBadges } from './PlatformBadges'
import { RowActions } from '@/app/portfolio/inventory/_components/RowActions'

// =============================================================================
// COLUMN WIDTH CONFIGURATION
// =============================================================================
// Single source of truth for all column widths
// Product column uses 1fr to fill remaining space (weighted)
// All other columns have fixed pixel widths for predictable layout

const COLUMN_WIDTHS = {
  select: 40,
  product: 'minmax(260px, 1fr)',  // Flexible - absorbs remaining space
  size: 56,
  sku: 100,
  purchasePrice: 90,
  lowestAsks: 100,
  spread: 72,           // More room for % values
  instantPayout: 145,   // Needs space for SX/AL + delta
  instantPL: 160,       // Needs space for +£432 (240%)
  lastSale: 80,
  volume: 70,           // Hidden on tablet
  listed: 100,
  daysHeld: 60,         // Hidden on tablet
  actions: 44,
} as const

// CSS Grid template for desktop (≥1200px)
const GRID_TEMPLATE_DESKTOP = `
  ${COLUMN_WIDTHS.select}px
  ${COLUMN_WIDTHS.product}
  ${COLUMN_WIDTHS.size}px
  ${COLUMN_WIDTHS.sku}px
  ${COLUMN_WIDTHS.purchasePrice}px
  ${COLUMN_WIDTHS.lowestAsks}px
  ${COLUMN_WIDTHS.spread}px
  ${COLUMN_WIDTHS.instantPayout}px
  ${COLUMN_WIDTHS.instantPL}px
  ${COLUMN_WIDTHS.lastSale}px
  ${COLUMN_WIDTHS.volume}px
  ${COLUMN_WIDTHS.listed}px
  ${COLUMN_WIDTHS.daysHeld}px
  ${COLUMN_WIDTHS.actions}px
`.replace(/\s+/g, ' ').trim()

// CSS Grid template for tablet (1024px - 1199px) - hides volume + daysHeld
const GRID_TEMPLATE_TABLET = `
  ${COLUMN_WIDTHS.select}px
  ${COLUMN_WIDTHS.product}
  ${COLUMN_WIDTHS.size}px
  ${COLUMN_WIDTHS.sku}px
  ${COLUMN_WIDTHS.purchasePrice}px
  ${COLUMN_WIDTHS.lowestAsks}px
  ${COLUMN_WIDTHS.spread}px
  ${COLUMN_WIDTHS.instantPayout}px
  ${COLUMN_WIDTHS.instantPL}px
  ${COLUMN_WIDTHS.lastSale}px
  ${COLUMN_WIDTHS.listed}px
  ${COLUMN_WIDTHS.actions}px
`.replace(/\s+/g, ' ').trim()

// =============================================================================
// TYPES
// =============================================================================

export interface InventoryV4TableProps {
  items: InventoryV4ItemFull[]
  loading: boolean
  selectedItems?: Set<string>
  onSelectionChange?: (selectedIds: Set<string>) => void
  onRowClick?: (item: InventoryV4ItemFull) => void
  // Item actions
  onEdit?: (item: InventoryV4ItemFull) => void
  onDuplicate?: (item: InventoryV4ItemFull) => void
  onAdjustTaxRate?: (item: InventoryV4ItemFull) => void
  onDelete?: (item: InventoryV4ItemFull) => void
  // StockX listing actions
  onListOnStockX?: (item: InventoryV4ItemFull) => void
  onRepriceListing?: (item: InventoryV4ItemFull) => void
  onDeactivateListing?: (item: InventoryV4ItemFull) => void
  onReactivateListing?: (item: InventoryV4ItemFull) => void
  onDeleteListing?: (item: InventoryV4ItemFull) => void
  onPrintStockXLabel?: (item: InventoryV4ItemFull) => void
  // Alias actions
  onAttachAliasProduct?: (item: InventoryV4ItemFull) => void
  onPlaceAliasListing?: (item: InventoryV4ItemFull) => void
  onEditAliasListing?: (item: InventoryV4ItemFull) => void
  onCancelAliasListing?: (item: InventoryV4ItemFull) => void
  // Status actions
  onAddToWatchlist?: (item: InventoryV4ItemFull) => void
  onAddToSellList?: (item: InventoryV4ItemFull) => void
  onMarkListed?: (item: InventoryV4ItemFull) => void
  onMarkSold?: (item: InventoryV4ItemFull) => void
  onMarkUnlisted?: (item: InventoryV4ItemFull) => void
  onTogglePersonals?: (item: InventoryV4ItemFull) => void
}

// =============================================================================
// COLUMN HELPER
// =============================================================================

const columnHelper = createColumnHelper<InventoryV4ItemFull>()

// =============================================================================
// INFO TOOLTIP COMPONENT
// =============================================================================

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3 h-3 text-black/40 hover:text-black/70 transition-colors cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatMoney(
  value: number | null | undefined,
  currency: string = 'GBP'
): string {
  if (value === null || value === undefined) return '—'
  const symbol = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency
  return `${symbol}${value.toFixed(2)}`
}

function getListPrice(item: InventoryV4ItemFull): number | null {
  // List price = NET at lowest ask (patient sell)
  const stockxNet = item.marketData?.netProceeds?.stockx?.netReceiveUserCurrency
  const aliasNet = item.marketData?.netProceeds?.alias?.netReceiveUserCurrency

  if (stockxNet && aliasNet) {
    return Math.max(stockxNet, aliasNet)
  }
  return stockxNet ?? aliasNet ?? null
}

function getNowPrice(item: InventoryV4ItemFull): number | null {
  // Now price = NET at highest bid (instant sell)
  // Uses properly fee-calculated bid net proceeds from pricing module
  return item.marketData?.bestBidNetProceeds ?? null
}

function getProfitLoss(
  price: number | null,
  cost: number | null
): { amount: number | null; isProfit: boolean; percent: number | null } {
  if (price === null || cost === null || cost === 0) {
    return { amount: null, isProfit: false, percent: null }
  }

  const amount = price - cost
  const percent = (amount / cost) * 100

  return {
    amount,
    isProfit: amount >= 0,
    percent,
  }
}

// =============================================================================
// CELL COMPONENTS
// =============================================================================

/**
 * ProductCell - Premium 2-line layout matching V3 style
 *
 * Structure:
 * - Line 1: Product Name (font-medium, tracking-tight)
 * - Line 2: Size UK • SKU (subtle metadata)
 */
function ProductCell({ item }: { item: InventoryV4ItemFull }) {
  const productName = item.style.name || item.style_id
  const brand = item.style.brand || ''

  // Build display name, avoiding duplicate brand prefix
  const displayName = productName.toLowerCase().startsWith(brand.toLowerCase())
    ? productName
    : brand
      ? `${brand} ${productName}`
      : productName

  // Colorway for secondary line
  const colorway = item.style.colorway || null

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2.5 group">
            {/* Image Thumbnail - 48px with subtle frame (matching V3) */}
            <div className="h-12 w-12 rounded-md shadow-sm ring-1 ring-black/10 overflow-hidden flex-shrink-0 bg-black/40 transition-transform duration-200 group-hover:-translate-y-[0.5px]">
              {item.style.primary_image_url ? (
                <img
                  src={item.style.primary_image_url}
                  alt={displayName}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-elev-2 text-[11px] font-medium text-dim">
                  {brand?.slice(0, 2).toUpperCase() || 'IT'}
                </div>
              )}
            </div>

            {/* Text Content - 2-line hierarchy */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Primary name - no truncation, show full name */}
              <span className="text-sm font-medium text-white leading-tight tracking-tight">
                {displayName}
              </span>

              {/* Secondary: colorway */}
              {colorway && (
                <span className="mt-0.5 text-[11px] text-white/45 leading-tight">
                  {colorway}
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[300px]">
          <div className="space-y-1.5 text-xs">
            <div className="font-medium text-sm">{displayName}</div>
            {brand && (
              <div className="text-muted-foreground">Brand: {brand}</div>
            )}
            {item.style.colorway && (
              <div className="text-muted-foreground">
                Colorway: {item.style.colorway}
              </div>
            )}
            {item.condition && (
              <div className="text-muted-foreground capitalize">
                Condition: {item.condition}
              </div>
            )}
            {item.purchase_source && (
              <div className="text-muted-foreground">
                Source: {item.purchase_source}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * SizeCell - Size with unit
 */
function SizeCell({ item }: { item: InventoryV4ItemFull }) {
  return (
    <span className="tabular-nums text-[13px] text-white/80">
      {item.size}
      <span className="text-white/40 text-[10px] ml-0.5">
        {item.size_unit}
      </span>
    </span>
  )
}

/**
 * SkuCell - Monospace SKU
 */
function SkuCell({ item }: { item: InventoryV4ItemFull }) {
  return (
    <span className="font-mono tabular-nums text-[12px] text-white/60">
      {item.style_id}
    </span>
  )
}

/**
 * CostCell - What user paid
 */
function CostCell({ item }: { item: InventoryV4ItemFull }) {
  if (item.purchase_price === null) {
    return <span className="text-white/40 text-[13px]">—</span>
  }

  return (
    <span className="tabular-nums text-[13px] text-white/75">
      {formatMoney(item.purchase_price, item.purchase_currency)}
    </span>
  )
}

/**
 * FeeBreakdownTooltip - Shows transparent fee calculation
 */
function FeeBreakdownTooltip({
  platform,
  proceeds,
  children
}: {
  platform: 'stockx' | 'alias'
  proceeds: {
    grossPrice: number
    grossPriceCurrency: string
    fees: { platformFee: number; paymentFee: number; shipping: number; total: number }
    netReceive: number
    netReceiveCurrency: string
    netReceiveUserCurrency: number
  } | null
  children: React.ReactNode
}) {
  if (!proceeds) return <>{children}</>

  const { grossPrice, grossPriceCurrency, fees, netReceive, netReceiveCurrency } = proceeds
  const symbol = { GBP: '£', USD: '$', EUR: '€' }[grossPriceCurrency] || grossPriceCurrency

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{children}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-0 overflow-hidden min-w-[180px]">
          {/* Header */}
          <div className={cn(
            'px-3 py-1.5 text-xs font-medium text-white',
            platform === 'stockx' ? 'bg-emerald-600' : 'bg-violet-600'
          )}>
            {platform === 'stockx' ? 'StockX' : 'Alias'} Fee Breakdown
          </div>

          {/* Breakdown */}
          <div className="px-3 py-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Highest Bid</span>
              <span className="font-medium tabular-nums">{symbol}{grossPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-400/80">
              <span>Platform Fee</span>
              <span className="tabular-nums">-{symbol}{fees.platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-400/80">
              <span>Payment Fee</span>
              <span className="tabular-nums">-{symbol}{fees.paymentFee.toFixed(2)}</span>
            </div>
            {fees.shipping > 0 && (
              <div className="flex justify-between text-red-400/80">
                <span>Shipping</span>
                <span className="tabular-nums">-{symbol}{fees.shipping.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-border/50 pt-1 mt-1 flex justify-between font-medium">
              <span className="text-emerald-400">You Receive</span>
              <span className="text-emerald-400 tabular-nums">{symbol}{netReceive.toFixed(2)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * InstantPayoutCell - Shows StockX vs Alias bid NET proceeds (instant liquidation)
 * Mirrors PlatformComparisonCell layout for consistency
 * Hover shows transparent fee breakdown
 */
function InstantPayoutCell({ item }: { item: InventoryV4ItemFull }) {
  const stockxProceeds = item.marketData?.bidNetProceeds?.stockx ?? null
  const aliasProceeds = item.marketData?.bidNetProceeds?.alias ?? null
  const stockxBidNet = stockxProceeds?.netReceiveUserCurrency ?? null
  const aliasBidNet = aliasProceeds?.netReceiveUserCurrency ?? null
  const currency = item.marketData?.currency || 'GBP'
  const bestBidPlatform = item.marketData?.bestBidPlatform

  // Calculate advantage (difference between platforms)
  let advantage: number | null = null
  if (stockxBidNet !== null && aliasBidNet !== null) {
    advantage = Math.abs(stockxBidNet - aliasBidNet)
  }

  // If no bid data at all
  if (stockxBidNet === null && aliasBidNet === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const formatPrice = (value: number) => {
    const symbol = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency
    return `${symbol}${value.toFixed(2)}`
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* StockX Row */}
      <FeeBreakdownTooltip platform="stockx" proceeds={stockxProceeds}>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
            bestBidPlatform === 'stockx' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500/60'
          )}>
            SX
          </span>
          {stockxBidNet !== null ? (
            <>
              <span className={cn(
                'tabular-nums text-[12px]',
                bestBidPlatform === 'stockx' ? 'text-white font-medium' : 'text-white/60'
              )}>
                {formatPrice(stockxBidNet)}
              </span>
              {bestBidPlatform === 'stockx' && advantage && advantage > 0 && (
                <span className="text-[11px] text-emerald-500 tabular-nums font-medium">
                  +{formatPrice(advantage)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-black/40">—</span>
          )}
        </div>
      </FeeBreakdownTooltip>

      {/* Alias Row */}
      <FeeBreakdownTooltip platform="alias" proceeds={aliasProceeds}>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
            bestBidPlatform === 'alias' ? 'bg-violet-500/20 text-violet-500' : 'bg-violet-500/10 text-violet-500/60'
          )}>
            AL
          </span>
          {aliasBidNet !== null ? (
            <>
              <span className={cn(
                'tabular-nums text-[12px]',
                bestBidPlatform === 'alias' ? 'text-white font-medium' : 'text-white/60'
              )}>
                {formatPrice(aliasBidNet)}
              </span>
              {bestBidPlatform === 'alias' && advantage && advantage > 0 && (
                <span className="text-[11px] text-emerald-500 tabular-nums font-medium">
                  +{formatPrice(advantage)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-black/40">—</span>
          )}
        </div>
      </FeeBreakdownTooltip>
    </div>
  )
}

/**
 * InstantPLCell - Shows P/L for both StockX and Alias instant payouts
 * Mirrors InstantPayoutCell layout for consistency
 */
function InstantPLCell({ item }: { item: InventoryV4ItemFull }) {
  const stockxBidNet = item.marketData?.bidNetProceeds?.stockx?.netReceiveUserCurrency ?? null
  const aliasBidNet = item.marketData?.bidNetProceeds?.alias?.netReceiveUserCurrency ?? null
  const cost = item.purchase_price
  const currency = item.marketData?.currency || 'GBP'
  const bestBidPlatform = item.marketData?.bestBidPlatform

  const stockxPL = getProfitLoss(stockxBidNet, cost)
  const aliasPL = getProfitLoss(aliasBidNet, cost)

  // If no bid data at all
  if (stockxBidNet === null && aliasBidNet === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const formatPL = (pl: { amount: number | null; isProfit: boolean; percent: number | null }) => {
    if (pl.amount === null) return null
    const symbol = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency
    return `${pl.isProfit ? '+' : '-'}${symbol}${Math.abs(pl.amount).toFixed(0)}`
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* StockX Row */}
      <div className="flex items-center gap-1">
        <span className={cn(
          'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
          bestBidPlatform === 'stockx' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500/60'
        )}>
          SX
        </span>
        {stockxPL.amount !== null ? (
          <span className={cn(
            'tabular-nums text-[12px] font-medium',
            stockxPL.isProfit ? 'text-emerald-400' : 'text-red-400',
            bestBidPlatform !== 'stockx' && 'opacity-60'
          )}>
            {formatPL(stockxPL)}
            {stockxPL.percent !== null && (
              <span className="text-[10px] ml-0.5 opacity-70">
                ({stockxPL.percent.toFixed(0)}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-black/40">—</span>
        )}
      </div>

      {/* Alias Row */}
      <div className="flex items-center gap-1">
        <span className={cn(
          'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
          bestBidPlatform === 'alias' ? 'bg-violet-500/20 text-violet-500' : 'bg-violet-500/10 text-violet-500/60'
        )}>
          AL
        </span>
        {aliasPL.amount !== null ? (
          <span className={cn(
            'tabular-nums text-[12px] font-medium',
            aliasPL.isProfit ? 'text-emerald-400' : 'text-red-400',
            bestBidPlatform !== 'alias' && 'opacity-60'
          )}>
            {formatPL(aliasPL)}
            {aliasPL.percent !== null && (
              <span className="text-[10px] ml-0.5 opacity-70">
                ({aliasPL.percent.toFixed(0)}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-black/40">—</span>
        )}
      </div>
    </div>
  )
}

/**
 * ListedCell - Shows platform badges with listing prices
 */
function ListedCell({ item }: { item: InventoryV4ItemFull }) {
  const activeListings = (item.listings ?? []).filter(
    (l) => l.status === 'active' || l.status === 'paused'
  )

  if (activeListings.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-col gap-0.5">
      {activeListings.slice(0, 2).map((listing) => (
        <div key={listing.id} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
              listing.platform === 'stockx' && 'bg-emerald-500/20 text-emerald-500',
              listing.platform === 'alias' && 'bg-violet-500/20 text-violet-500',
              listing.platform !== 'stockx' && listing.platform !== 'alias' && 'bg-zinc-500/20 text-zinc-400'
            )}
          >
            {listing.platform === 'stockx' ? 'SX' : listing.platform === 'alias' ? 'AL' : listing.platform.slice(0, 2).toUpperCase()}
          </span>
          <span className="tabular-nums text-[12px] text-white/80">
            {formatMoney(listing.listed_price, listing.listed_currency)}
          </span>
        </div>
      ))}
      {activeListings.length > 2 && (
        <span className="text-[10px] text-white/40">+{activeListings.length - 2} more</span>
      )}
    </div>
  )
}

/**
 * SpreadCell - Shows bid-ask spread (market liquidity indicator)
 * Tight spread = liquid market, wide spread = illiquid
 */
function SpreadCell({ item }: { item: InventoryV4ItemFull }) {
  const listPrice = getListPrice(item)
  const nowPrice = getNowPrice(item)

  if (listPrice === null || nowPrice === null) {
    return <span className="text-white/40 text-[13px]">—</span>
  }

  const spreadPercent = ((listPrice - nowPrice) / listPrice) * 100

  // Color coding: green < 5%, yellow 5-10%, orange 10-15%, red > 15%
  const colorClass = spreadPercent < 5
    ? 'text-emerald-400'
    : spreadPercent < 10
      ? 'text-yellow-400'
      : spreadPercent < 15
        ? 'text-orange-400'
        : 'text-red-400'

  return (
    <span className={cn('tabular-nums text-[12px] font-medium', colorClass)}>
      {spreadPercent.toFixed(0)}%
    </span>
  )
}

/**
 * LastSaleCell - Shows Alias last sale price (Alias-only data)
 * StockX V2 API doesn't provide last sale data
 */
function LastSaleCell({ item }: { item: InventoryV4ItemFull }) {
  const lastSale = item.marketData?.aliasExtended?.lastSalePriceUserCurrency ?? null
  const currency = item.marketData?.currency || 'GBP'

  if (lastSale === null) {
    return <span className="text-white/40 text-[12px]">—</span>
  }

  const symbol = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency

  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center justify-center font-semibold rounded h-4 px-0.5 text-[9px] bg-violet-500/20 text-violet-500">
        AL
      </span>
      <span className="tabular-nums text-[12px] text-white/70">
        {symbol}{lastSale.toFixed(0)}
      </span>
    </div>
  )
}

/**
 * VolumeCell - Shows Alias 72h / 30d sales volume (Alias-only data)
 * Single-line format: "AL 68 / 132" with visual hierarchy
 * - 72h value: primary signal, velocity-colored, semibold
 * - 30d value: secondary context, muted, regular weight
 */
function VolumeCell({ item }: { item: InventoryV4ItemFull }) {
  const sales72h = item.marketData?.aliasExtended?.salesLast72h ?? null
  const sales30d = item.marketData?.aliasExtended?.salesLast30d ?? null

  // No meaningful data → single muted dash
  const hasNoData = (sales72h === null && sales30d === null) ||
                    (sales72h === 0 && sales30d === 0)
  if (hasNoData) {
    return <span className="text-white/40 text-[12px]">—</span>
  }

  // Velocity-based color for 72h value only
  // Green: ≥10, Amber: 3-9, Muted: 0-2
  const get72hColorClass = (count: number | null): string => {
    if (count === null || count <= 2) return 'text-white/50'
    if (count >= 10) return 'text-emerald-400'
    return 'text-amber-400' // 3-9
  }

  // Format condition for tooltip
  const formatCondition = (condition: string | undefined): string => {
    if (!condition) return 'New'
    return condition.charAt(0).toUpperCase() + condition.slice(1)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <span className="inline-flex items-center justify-center font-semibold rounded h-4 px-0.5 text-[9px] bg-violet-500/20 text-violet-400">
              AL
            </span>
            <span className="tabular-nums text-[12px] flex items-center">
              <span className={cn('font-semibold', get72hColorClass(sales72h))}>
                {sales72h ?? 0}
              </span>
              <span className="text-white/30 mx-0.5">/</span>
              <span className="text-white/50 font-normal">
                {sales30d ?? 0}
              </span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-medium mb-1">Alias sales volume</div>
          <div className="text-white/80">Last 72h: {sales72h ?? 0} sales</div>
          <div className="text-white/80">Last 30d: {sales30d ?? 0} sales</div>
          <div className="text-white/60 mt-1">Condition: {formatCondition(item.condition)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * DaysHeldCell - Shows days since purchase
 */
function DaysHeldCell({ item }: { item: InventoryV4ItemFull }) {
  if (!item.purchase_date) {
    return <span className="text-white/40 text-[13px]">—</span>
  }

  const purchaseDate = new Date(item.purchase_date)
  const now = new Date()
  const diffMs = now.getTime() - purchaseDate.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Color coding: green < 30, yellow 30-60, orange 60-90, red > 90
  const colorClass = days < 30
    ? 'text-emerald-400'
    : days < 60
      ? 'text-yellow-400'
      : days < 90
        ? 'text-orange-400'
        : 'text-red-400'

  return (
    <span className={cn('tabular-nums text-[13px] font-medium', colorClass)}>
      {days}d
    </span>
  )
}

/**
 * PlatformComparisonCell - Shows StockX vs Alias lowest asks
 * Clean design: just prices with winner bold, loser dimmed
 * Hover on winner reveals delta tooltip
 * Badge colors: StockX=emerald-500, Alias=violet-500
 */
function PlatformComparisonCell({ item }: { item: InventoryV4ItemFull }) {
  const stockxAsk = item.marketData?.inputs?.stockxAsk ?? null
  const aliasAsk = item.marketData?.inputs?.aliasAsk ?? null
  const currency = item.marketData?.currency || 'GBP'
  const bestPlatform = item.marketData?.bestPlatformToSell
  const advantage = item.marketData?.platformAdvantage

  // If no market data at all
  if (stockxAsk === null && aliasAsk === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const formatPrice = (value: number) => {
    const symbol = { GBP: '£', USD: '$', EUR: '€' }[currency] || currency
    return `${symbol}${value.toFixed(2)}`
  }

  // Build tooltip text for winner
  const getTooltipText = (platform: 'stockx' | 'alias') => {
    if (!advantage || advantage <= 0) return null
    const loserName = platform === 'stockx' ? 'Alias' : 'StockX'
    return `Cheaper by ${formatPrice(advantage)} vs ${loserName}`
  }

  const PriceWithTooltip = ({
    price,
    platform,
    isWinner,
  }: {
    price: number
    platform: 'stockx' | 'alias'
    isWinner: boolean
  }) => {
    const tooltipText = isWinner ? getTooltipText(platform) : null

    const priceElement = (
      <span className={cn(
        'tabular-nums text-[12px]',
        isWinner ? 'text-white font-medium' : 'text-white/60'
      )}>
        {formatPrice(price)}
      </span>
    )

    if (tooltipText) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{priceElement}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-xs">
            <span className="text-emerald-400">{tooltipText}</span>
          </TooltipContent>
        </Tooltip>
      )
    }

    return priceElement
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-0.5">
        {/* StockX Row */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
            bestPlatform === 'stockx' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 text-emerald-500/50'
          )}>
            SX
          </span>
          {stockxAsk !== null ? (
            <PriceWithTooltip
              price={stockxAsk}
              platform="stockx"
              isWinner={bestPlatform === 'stockx'}
            />
          ) : (
            <span className="text-[11px] text-black/40">—</span>
          )}
        </div>

        {/* Alias Row */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center justify-center font-semibold rounded h-5 min-w-[20px] px-1 text-[10px]',
            bestPlatform === 'alias' ? 'bg-violet-500/20 text-violet-500' : 'bg-violet-500/10 text-violet-500/50'
          )}>
            AL
          </span>
          {aliasAsk !== null ? (
            <PriceWithTooltip
              price={aliasAsk}
              platform="alias"
              isWinner={bestPlatform === 'alias'}
            />
          ) : (
            <span className="text-[11px] text-black/40">—</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * ActionsCell - Uses shared RowActions component
 * Derives V4 listing state directly from item.listings
 * Full parity with V3 action menu
 */
function ActionsCell({
  item,
  // Item actions
  onEdit,
  onDuplicate,
  onAdjustTaxRate,
  onDelete,
  // StockX listing actions
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onPrintStockXLabel,
  // Alias actions
  onAttachAliasProduct,
  onPlaceAliasListing,
  onEditAliasListing,
  onCancelAliasListing,
  // Status actions
  onAddToWatchlist,
  onAddToSellList,
  onMarkListed,
  onMarkSold,
  onMarkUnlisted,
  onTogglePersonals,
}: {
  item: InventoryV4ItemFull
  // Item actions
  onEdit?: (item: InventoryV4ItemFull) => void
  onDuplicate?: (item: InventoryV4ItemFull) => void
  onAdjustTaxRate?: (item: InventoryV4ItemFull) => void
  onDelete?: (item: InventoryV4ItemFull) => void
  // StockX listing actions
  onListOnStockX?: (item: InventoryV4ItemFull) => void
  onRepriceListing?: (item: InventoryV4ItemFull) => void
  onDeactivateListing?: (item: InventoryV4ItemFull) => void
  onReactivateListing?: (item: InventoryV4ItemFull) => void
  onDeleteListing?: (item: InventoryV4ItemFull) => void
  onPrintStockXLabel?: (item: InventoryV4ItemFull) => void
  // Alias actions
  onAttachAliasProduct?: (item: InventoryV4ItemFull) => void
  onPlaceAliasListing?: (item: InventoryV4ItemFull) => void
  onEditAliasListing?: (item: InventoryV4ItemFull) => void
  onCancelAliasListing?: (item: InventoryV4ItemFull) => void
  // Status actions
  onAddToWatchlist?: (item: InventoryV4ItemFull) => void
  onAddToSellList?: (item: InventoryV4ItemFull) => void
  onMarkListed?: (item: InventoryV4ItemFull) => void
  onMarkSold?: (item: InventoryV4ItemFull) => void
  onMarkUnlisted?: (item: InventoryV4ItemFull) => void
  onTogglePersonals?: (item: InventoryV4ItemFull) => void
}) {
  // V4: Extract StockX listing directly from item.listings (source of truth)
  const stockxListing = item.listings.find(l => l.platform === 'stockx') || null
  const stockxMapped = !!item.style.stockx_product_id

  // V4: Extract Alias listing
  const aliasListing = item.listings.find(l => l.platform === 'alias') || null
  const aliasListingStatus = aliasListing?.status || null

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <RowActions
        status={item.status}
        // Item actions
        onEdit={onEdit ? () => onEdit(item) : () => {}}
        onDuplicate={onDuplicate ? () => onDuplicate(item) : undefined}
        onAdjustTaxRate={onAdjustTaxRate ? () => onAdjustTaxRate(item) : undefined}
        onDelete={onDelete ? () => onDelete(item) : undefined}
        // StockX actions - V4 listing is source of truth
        stockxMapped={stockxMapped}
        stockxListing={stockxListing}
        onListOnStockX={onListOnStockX ? () => onListOnStockX(item) : undefined}
        onRepriceListing={onRepriceListing ? () => onRepriceListing(item) : undefined}
        onDeactivateListing={onDeactivateListing ? () => onDeactivateListing(item) : undefined}
        onReactivateListing={onReactivateListing ? () => onReactivateListing(item) : undefined}
        onDeleteListing={onDeleteListing ? () => onDeleteListing(item) : undefined}
        onPrintStockXLabel={onPrintStockXLabel ? () => onPrintStockXLabel(item) : undefined}
        // Alias actions
        aliasListingStatus={aliasListingStatus}
        onAttachAliasProduct={onAttachAliasProduct ? () => onAttachAliasProduct(item) : undefined}
        onPlaceAliasListing={onPlaceAliasListing ? () => onPlaceAliasListing(item) : undefined}
        onEditAliasListing={onEditAliasListing ? () => onEditAliasListing(item) : undefined}
        onCancelAliasListing={onCancelAliasListing ? () => onCancelAliasListing(item) : undefined}
        // Status actions
        onAddToWatchlist={onAddToWatchlist ? () => onAddToWatchlist(item) : undefined}
        onAddToSellList={onAddToSellList ? () => onAddToSellList(item) : undefined}
        onMarkListed={onMarkListed ? () => onMarkListed(item) : undefined}
        onMarkSold={onMarkSold ? () => onMarkSold(item) : () => {}}
        onMarkUnlisted={onMarkUnlisted ? () => onMarkUnlisted(item) : undefined}
        onTogglePersonals={onTogglePersonals ? () => onTogglePersonals(item) : undefined}
      />
    </div>
  )
}

// NOTE: SkeletonRow removed - loading state now uses inline grid skeleton

// =============================================================================
// TABLE COMPONENT
// =============================================================================

export function InventoryV4Table({
  items,
  loading,
  selectedItems = new Set(),
  onSelectionChange,
  onRowClick,
  // Item actions
  onEdit,
  onDuplicate,
  onAdjustTaxRate,
  onDelete,
  // StockX listing actions
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteListing,
  onPrintStockXLabel,
  // Alias actions
  onAttachAliasProduct,
  onPlaceAliasListing,
  onEditAliasListing,
  onCancelAliasListing,
  // Status actions
  onAddToWatchlist,
  onAddToSellList,
  onMarkListed,
  onMarkSold,
  onMarkUnlisted,
  onTogglePersonals,
}: InventoryV4TableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange(new Set(items.map((item) => item.id.toString())))
    } else {
      onSelectionChange(new Set())
    }
  }

  const handleSelectRow = (itemId: string, checked: boolean) => {
    if (!onSelectionChange) return
    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    onSelectionChange(newSelection)
  }

  const allSelected =
    items.length > 0 &&
    items.every((item) => selectedItems.has(item.id.toString()))
  const someSelected =
    items.some((item) => selectedItems.has(item.id.toString())) && !allSelected

  // Define columns
  const columns = useMemo(
    () => [
      // 1. Checkbox (44px)
      columnHelper.display({
        id: 'select',
        header: () => (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
              onClick={(e) => e.stopPropagation()}
              className="border-black/60 data-[state=checked]:bg-black data-[state=checked]:border-black"
            />
          </div>
        ),
        cell: (info) => {
          const item = info.row.original
          const isSelected = selectedItems.has(item.id.toString())

          return (
            <div
              className="flex items-center justify-center h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) =>
                  handleSelectRow(item.id.toString(), checked as boolean)
                }
                aria-label={`Select ${item.style_id}`}
              />
            </div>
          )
        },
        enableSorting: false,
      }),

      // 2. Product (weighted - 1fr)
      columnHelper.accessor((row) => row.style.name || row.style_id, {
        id: 'product',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black">Product</span>
            <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
          </div>
        ),
        cell: ({ row }) => <ProductCell item={row.original} />,
      }),

      // 3. Size (56px)
      columnHelper.accessor('size', {
        id: 'size',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black">Size</span>
            <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
          </div>
        ),
        cell: ({ row }) => <SizeCell item={row.original} />,
      }),

      // 4. SKU (96px)
      columnHelper.accessor('style_id', {
        id: 'sku',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black">SKU</span>
            <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
          </div>
        ),
        cell: ({ row }) => <SkuCell item={row.original} />,
      }),

      // 5. Purchase Price (88px)
      columnHelper.accessor((row) => row.purchase_price ?? 0, {
        id: 'purchase_price',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black leading-tight">
              Purchase<br />Price
            </span>
            <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
          </div>
        ),
        cell: ({ row }) => <CostCell item={row.original} />,
      }),

      // 6. Lowest Asks (104px)
      columnHelper.display({
        id: 'lowest_asks',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black leading-tight">
              Lowest<br />Asks
            </span>
            <InfoTip text="Current lowest asking prices on StockX and Alias" />
          </div>
        ),
        cell: ({ row }) => <PlatformComparisonCell item={row.original} />,
      }),

      // 7. Spread (60px)
      columnHelper.display({
        id: 'spread',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black">Spread</span>
            <InfoTip text="Gap between ask and bid. Lower = more liquid" />
          </div>
        ),
        cell: ({ row }) => <SpreadCell item={row.original} />,
      }),

      // 8. Instant Payout (112px)
      columnHelper.accessor((row) => getNowPrice(row) ?? 0, {
        id: 'instant_payout',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black leading-tight">
              Instant<br />Payout
            </span>
            <InfoTip text="Net payout if you sold to highest bidder now" />
            <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
          </div>
        ),
        cell: ({ row }) => <InstantPayoutCell item={row.original} />,
      }),

      // 9. Instant P/L (112px)
      columnHelper.accessor(
        (row) => {
          const nowPrice = getNowPrice(row)
          const cost = row.purchase_price
          if (nowPrice === null || cost === null) return 0
          return nowPrice - cost
        },
        {
          id: 'instant_pl',
          header: () => (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-black leading-tight">
                Instant<br />P/L
              </span>
              <InfoTip text="Profit/loss if instant-sold now" />
              <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
            </div>
          ),
          cell: ({ row }) => <InstantPLCell item={row.original} />,
        }
      ),

      // 10. Last Sale (80px)
      columnHelper.display({
        id: 'last_sale',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black leading-tight">
              Last<br />Sale
            </span>
            <InfoTip text="Most recent sale price (Alias only - StockX V2 API doesn't provide this)" />
          </div>
        ),
        cell: ({ row }) => <LastSaleCell item={row.original} />,
      }),

      // 11. Volume (72px) - Hidden on tablet via CSS
      columnHelper.display({
        id: 'volume',
        header: () => (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-black leading-tight">
              72h<br />/30d
            </span>
            <InfoTip text="Sales volume: 72 hours / 30 days (Alias only)" />
          </div>
        ),
        cell: ({ row }) => <VolumeCell item={row.original} />,
      }),

      // 12. Listed (104px)
      columnHelper.display({
        id: 'listed',
        header: () => (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-black">Listed</span>
            <InfoTip text="Platforms where this item is actively listed for sale" />
          </div>
        ),
        cell: ({ row }) => <ListedCell item={row.original} />,
      }),

      // 13. Days Held (64px) - Hidden on tablet via CSS
      columnHelper.accessor(
        (row) => {
          if (!row.purchase_date) return 9999
          const purchaseDate = new Date(row.purchase_date)
          const now = new Date()
          return Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        {
          id: 'days_held',
          header: () => (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-black leading-tight">
                Days<br />Held
              </span>
              <ArrowUpDown className="w-2.5 h-2.5 text-black/60" />
            </div>
          ),
          cell: ({ row }) => <DaysHeldCell item={row.original} />,
        }
      ),

      // 14. Actions (48px)
      columnHelper.display({
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <ActionsCell
            item={row.original}
            // Item actions
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onAdjustTaxRate={onAdjustTaxRate}
            onDelete={onDelete}
            // StockX actions
            onListOnStockX={onListOnStockX}
            onRepriceListing={onRepriceListing}
            onDeactivateListing={onDeactivateListing}
            onReactivateListing={onReactivateListing}
            onDeleteListing={onDeleteListing}
            onPrintStockXLabel={onPrintStockXLabel}
            // Alias actions
            onAttachAliasProduct={onAttachAliasProduct}
            onPlaceAliasListing={onPlaceAliasListing}
            onEditAliasListing={onEditAliasListing}
            onCancelAliasListing={onCancelAliasListing}
            // Status actions
            onAddToWatchlist={onAddToWatchlist}
            onAddToSellList={onAddToSellList}
            onMarkListed={onMarkListed}
            onMarkSold={onMarkSold}
            onMarkUnlisted={onMarkUnlisted}
            onTogglePersonals={onTogglePersonals}
          />
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSelected, someSelected, selectedItems, onEdit, onDuplicate, onAdjustTaxRate, onDelete, onListOnStockX, onRepriceListing, onDeactivateListing, onReactivateListing, onDeleteListing, onPrintStockXLabel, onAttachAliasProduct, onPlaceAliasListing, onEditAliasListing, onCancelAliasListing, onAddToWatchlist, onAddToSellList, onMarkListed, onMarkSold, onMarkUnlisted, onTogglePersonals]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Virtual scrolling setup
  const ROW_HEIGHT = 60 // matches min-h-[60px]
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8, // Render 8 extra rows above/below viewport (balanced for perf)
  })

  // Loading state - uses same CSS Grid layout
  if (loading && items.length === 0) {
    return (
      <div className="max-w-[1650px] mx-auto">
        <div className="rounded-2xl border border-border bg-elev-1 overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]" role="table">
              {/* Header skeleton */}
              <div role="rowgroup" className="sticky top-0 bg-panel border-b border-keyline z-10">
                <div
                  role="row"
                  className="grid items-end gap-0"
                  style={{ gridTemplateColumns: GRID_TEMPLATE_DESKTOP }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      role="columnheader"
                      className="py-2.5 px-2 flex items-end"
                    >
                      {col.id === 'select' ? (
                        <Skeleton className="h-4 w-4" />
                      ) : col.id === 'actions' ? null : (
                        <Skeleton className="h-3 w-16" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Body skeleton rows */}
              <div role="rowgroup" className="divide-y divide-border/30">
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    role="row"
                    className="grid items-center gap-0"
                    style={{ gridTemplateColumns: GRID_TEMPLATE_DESKTOP }}
                  >
                    {/* Checkbox */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-4" />
                    </div>
                    {/* Product */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center gap-2.5">
                      <Skeleton className="h-12 w-12 rounded-md flex-shrink-0" />
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    {/* Size */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-8" />
                    </div>
                    {/* SKU */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-16" />
                    </div>
                    {/* Purchase Price */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-14" />
                    </div>
                    {/* Lowest Asks */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                    {/* Spread */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-8" />
                    </div>
                    {/* Instant Payout */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                    {/* Instant P/L */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-5 w-14" />
                        <Skeleton className="h-5 w-14" />
                      </div>
                    </div>
                    {/* Last Sale */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-4 w-12" />
                    </div>
                    {/* Volume */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center hidden xl:flex">
                      <Skeleton className="h-4 w-10" />
                    </div>
                    {/* Listed */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-5 w-16" />
                    </div>
                    {/* Days Held */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center hidden xl:flex">
                      <Skeleton className="h-4 w-8" />
                    </div>
                    {/* Actions */}
                    <div role="cell" className="py-2 px-2 min-h-[60px] flex items-center">
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-white mb-2">
          No items in inventory
        </h3>
        <p className="text-sm text-white/60 max-w-sm">
          Add your first item to start tracking your inventory and market
          prices.
        </p>
      </div>
    )
  }

  // Column IDs that should be hidden on tablet
  const TABLET_HIDDEN_COLUMNS = ['volume', 'days_held']

  // Get virtual rows
  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalHeight = rowVirtualizer.getTotalSize()

  return (
    <div className="max-w-[1650px] mx-auto">
      {/* CSS Grid Table Container */}
      <div className="rounded-2xl border border-border bg-elev-1 overflow-hidden shadow-soft">
        {/* Scrollable container for horizontal overflow AND virtual scrolling */}
        {/* Uses flex-1 + min-h-0 pattern for robust cross-device height */}
        <div
          ref={tableContainerRef}
          className="overflow-auto flex-1 min-h-0"
          style={{
            maxHeight: 'calc(100dvh - 320px)', // dvh for iOS Safari address bar
            minHeight: '400px',
            WebkitOverflowScrolling: 'touch', // iOS smooth scrolling
          }}
        >
          {/* Grid Table */}
          <div
            className="min-w-[1100px]"
            role="table"
            aria-label="Inventory table"
          >
            {/* Header Row - Sticky */}
            <div
              role="rowgroup"
              className="sticky top-0 z-10 font-semibold rounded-t-lg"
              style={{
                backgroundColor: '#FF7900',
                color: '#000000',
              }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <div
                  key={headerGroup.id}
                  role="row"
                  className="grid items-end gap-0"
                  style={{ gridTemplateColumns: GRID_TEMPLATE_DESKTOP }}
                >
                  {headerGroup.headers.map((header) => {
                    const isHiddenOnTablet = TABLET_HIDDEN_COLUMNS.includes(header.id)

                    // Left-aligned columns: select, product, actions
                    const isLeftAligned = ['select', 'product', 'actions'].includes(header.id)

                    return (
                      <div
                        key={header.id}
                        role="columnheader"
                        className={cn(
                          'py-2.5 px-2 flex items-center', // Vertically centered
                          !isLeftAligned && 'justify-center text-center', // Horizontally center most columns
                          header.column.getCanSort() && 'cursor-pointer select-none hover:bg-black/10 transition-colors',
                          isHiddenOnTablet && 'hidden xl:flex' // Hide on tablet, show on desktop
                        )}
                        onClick={() => {
                          const handler = header.column.getToggleSortingHandler()
                          if (handler) handler({} as any)
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Body Rows - Virtualized */}
            <div
              role="rowgroup"
              style={{
                height: `${totalHeight}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                return (
                  <div
                    key={row.id}
                    role="row"
                    data-index={virtualRow.index}
                    className={cn(
                      'grid items-center gap-0 transition-colors absolute w-full border-b border-border/30',
                      onRowClick && 'cursor-pointer hover:bg-soft/50',
                      selectedItems.has(row.original.id.toString()) && 'bg-white/[0.04]'
                    )}
                    style={{
                      gridTemplateColumns: GRID_TEMPLATE_DESKTOP,
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isHiddenOnTablet = TABLET_HIDDEN_COLUMNS.includes(cell.column.id)

                      return (
                        <div
                          key={cell.id}
                          role="cell"
                          className={cn(
                            'py-2 px-2 h-full flex items-center',
                            isHiddenOnTablet && 'hidden xl:flex' // Hide on tablet, show on desktop
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Styles - Injected via style tag for grid template changes */}
      <style jsx>{`
        @media (max-width: 1279px) {
          /* Tablet: Use condensed grid template without volume and days_held */
          div[role="row"] {
            grid-template-columns: ${GRID_TEMPLATE_TABLET} !important;
          }
        }
      `}</style>
    </div>
  )
}
