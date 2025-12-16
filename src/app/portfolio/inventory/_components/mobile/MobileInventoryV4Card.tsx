'use client'

/**
 * MobileInventoryV4Card - Mobile card layout for V4 inventory items
 *
 * Displays V4 inventory items with:
 * - Unified market pricing (ARCHVD price from StockX + Alias)
 * - Fee-adjusted profit/loss
 * - Best platform recommendation
 * - Platform comparison (StockX vs Alias lowest asks)
 */

import { useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, TrendingUp, TrendingDown, Zap, Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { generateProductSlug } from '@/lib/utils/slug'
import { MobileItemActionsSheet } from './MobileItemActionsSheet'
import type { InventoryV4ItemFull } from '@/lib/inventory-v4/types'

interface MobileInventoryV4CardProps {
  item: InventoryV4ItemFull
  isSelected: boolean
  onSelectionChange: (checked: boolean) => void
  // Item actions
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  // StockX actions
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onDeactivateListing?: () => void
  onReactivateListing?: () => void
  // Status actions
  onMarkSold?: () => void
}

export function MobileInventoryV4Card({
  item,
  isSelected,
  onSelectionChange,
  onEdit,
  onDuplicate,
  onDelete,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onMarkSold,
}: MobileInventoryV4CardProps) {
  const router = useRouter()
  const { symbol } = useCurrency()
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)

  // Extract StockX listing (source of truth for listing status)
  const stockxListing = item.listings.find(l => l.platform === 'stockx')

  // Derive listing status
  const listingStatus = useMemo(() => {
    if (!stockxListing) return 'Unlisted'
    if (stockxListing.status === 'active') return 'Listed'
    if (stockxListing.status === 'paused') return 'Paused'
    return 'Unlisted'
  }, [stockxListing])

  // Status badge styling
  const statusBadge = useMemo(() => {
    if (listingStatus === 'Listed') {
      return {
        label: 'Listed',
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-semibold shadow-sm shadow-emerald-500/10',
      }
    }
    if (listingStatus === 'Paused') {
      return {
        label: 'Paused',
        className: 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-semibold shadow-sm shadow-amber-400/10',
      }
    }
    return {
      label: 'Unlisted',
      className: 'bg-muted/10 text-muted border-muted/30',
    }
  }, [listingStatus])

  // Generate market page URL
  const productName = `${item.style.brand || ''} ${item.style.name || ''}`.trim()
  const slug = item.style_id ? generateProductSlug(productName, item.style_id) : null
  const marketUrl = slug ? `/portfolio/market/${slug}?itemId=${item.id}` : `/portfolio/inventory`

  // Market data from V4
  const marketData = item.marketData
  const currencySymbol = symbol()

  // Format money (absolute value with currency symbol)
  const formatMoney = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    return `${currencySymbol}${Math.abs(value).toFixed(2)}`
  }

  // Format delta (signed value for advantages/differences)
  const formatDelta = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—'
    return `${currencySymbol}${value.toFixed(2)}`
  }

  // Purchase price
  const purchasePrice = item.purchase_price

  // Market price (ARCHVD unified price)
  const marketPrice = marketData?.value ?? null

  // Listed price (current StockX ask)
  const listedPrice = stockxListing?.listed_price ?? null

  // Real profit/loss (fee-adjusted)
  const realProfit = marketData?.realProfit ?? null
  const realProfitPercent = marketData?.realProfitPercent ?? null

  // Best platform recommendation
  const bestPlatform = marketData?.bestPlatformToSell
  const platformAdvantage = marketData?.platformAdvantage

  // Platform lowest asks
  const stockxAsk = marketData?.inputs?.stockxAsk ?? null
  const aliasAsk = marketData?.inputs?.aliasAsk ?? null

  // Prefetch guard - useRef to avoid re-renders on prefetch
  const hasPrefetchedRef = useRef(false)

  // Prefetch on first interaction intent (hover/focus/touch)
  // Uses ref instead of state to prevent re-renders and spam during scroll
  const handlePrefetch = useCallback(() => {
    if (!hasPrefetchedRef.current && marketUrl !== '/portfolio/inventory') {
      router.prefetch(marketUrl)
      hasPrefetchedRef.current = true
    }
  }, [marketUrl, router])

  // Handle card click (navigate to market page)
  const handleCardClick = () => {
    router.push(marketUrl)
  }

  // Can list on StockX if mapped and not already listed
  const canListOnStockX = !!item.style.stockx_product_id && !stockxListing

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCardClick()
          }
        }}
        // Prefetch on first interaction intent for instant navigation
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        onTouchStart={handlePrefetch}
        aria-label={`${item.style_id} US ${item.size}`}
        className={cn(
          'relative bg-gradient-to-br from-elev-1 to-elev-1/80 rounded-xl border-2 transition-all duration-200 overflow-hidden cursor-pointer',
          // Active press feedback + touch-manipulation for iOS 300ms delay fix
          'active:scale-[0.99] active:brightness-95 touch-manipulation',
          isSelected
            ? 'border-[#00FF94]/60 shadow-lg shadow-[#00FF94]/10'
            : 'border-[#00FF94]/10 hover:border-[#00FF94]/30'
        )}
      >
        {/* Card Content */}
        <div className="p-4">
          {/* Top Row: Checkbox + Image + Basic Info + Menu */}
          <div className="flex items-start gap-3 mb-3">
            {/* Checkbox */}
            <div
              className="flex items-center pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                aria-label={`Select ${item.style_id}`}
              />
            </div>

            {/* Product Image */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-elev-2 border border-border/40">
                {item.style.primary_image_url ? (
                  <img
                    src={item.style.primary_image_url}
                    alt={item.style.name || item.style_id}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                    No Image
                  </div>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white line-clamp-2 mb-1 leading-tight">
                {item.style.name || item.style_id}
              </h3>
              <p className="text-[11px] text-white/55 mono mb-1 leading-tight">{item.style_id}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
                  {statusBadge.label}
                </Badge>
                <span className="text-[10px] text-white/40">US {item.size}</span>
              </div>
            </div>

            {/* Actions Menu Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setActionsSheetOpen(true)
              }}
              className="p-2 hover:bg-elev-2 rounded-lg transition-colors flex-shrink-0"
              aria-label="Item actions"
            >
              <MoreVertical className="h-5 w-5 text-muted" />
            </button>
          </div>

          {/* Middle Row: Financial Data (2 columns) */}
          <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-border/30">
            {/* Left Column */}
            <div className="space-y-2.5 pr-3 border-r border-soft/20">
              <div>
                <div className="text-[11px] text-muted/70 mb-0.5">Purchase</div>
                <div className="text-xs font-medium mono tabular-nums text-fg leading-tight">
                  {purchasePrice !== null ? formatMoney(purchasePrice) : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-muted/70 mb-0.5">Market Price</div>
                <div className="text-xs font-medium mono tabular-nums text-fg leading-tight flex items-center gap-1">
                  {marketPrice !== null ? formatMoney(marketPrice) : '—'}
                  {marketData?.source && (
                    <span className="text-[9px] text-white/40 uppercase">
                      {marketData.source === 'stockx' ? 'SX' : 'AL'}
                    </span>
                  )}
                </div>
              </div>

              {listedPrice !== null && (
                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Listed</div>
                  <div className="text-xs font-medium mono tabular-nums text-emerald-500 leading-tight">
                    {formatMoney(listedPrice)}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-2.5 pl-2">
              {/* Platform Comparison */}
              <div>
                <div className="text-[11px] text-muted/70 mb-0.5">Lowest Asks</div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-white/50 w-7">SX:</span>
                    <span className={cn(
                      'mono tabular-nums',
                      bestPlatform === 'stockx' ? 'text-emerald-400 font-medium' : 'text-white/60'
                    )}>
                      {stockxAsk !== null ? formatMoney(stockxAsk) : '—'}
                    </span>
                    {bestPlatform === 'stockx' && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-white/50 w-7">AL:</span>
                    <span className={cn(
                      'mono tabular-nums',
                      bestPlatform === 'alias' ? 'text-emerald-400 font-medium' : 'text-white/60'
                    )}>
                      {aliasAsk !== null ? formatMoney(aliasAsk) : '—'}
                    </span>
                    {bestPlatform === 'alias' && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                  </div>
                </div>
              </div>

              {/* Real Profit/Loss */}
              <div>
                <div className="text-[11px] text-muted/70 mb-0.5">Net Profit</div>
                <div
                  className={cn(
                    'text-xs font-semibold mono tabular-nums leading-tight flex items-center gap-1',
                    realProfit !== null && realProfit > 0
                      ? 'text-emerald-500'
                      : realProfit !== null && realProfit < 0
                        ? 'text-red-500'
                        : 'text-muted'
                  )}
                >
                  {realProfit !== null ? (
                    <>
                      {realProfit > 0 ? <TrendingUp className="h-3 w-3" /> : realProfit < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                      {realProfit > 0 && '+'}
                      {formatMoney(realProfit)}
                      {realProfitPercent !== null && (
                        <span className="text-[10px] opacity-70">
                          ({realProfitPercent > 0 ? '+' : ''}{realProfitPercent.toFixed(0)}%)
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              {/* Best Platform Badge */}
              {bestPlatform && platformAdvantage != null && platformAdvantage > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] text-amber-400">
                    +{formatDelta(platformAdvantage)} on {bestPlatform === 'stockx' ? 'StockX' : 'Alias'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Meta Info */}
          <div className="flex items-center justify-between text-[10px] text-muted/60">
            <div>
              {item.purchase_date
                ? `Purchased ${new Date(item.purchase_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`
                : 'No purchase date'}
            </div>
            <div className="flex items-center gap-1">
              {item.style.stockx_product_id && <span className="text-blue-400">SX</span>}
              {item.style.alias_catalog_id && <span className="text-purple-400">AL</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Actions Sheet */}
      <MobileItemActionsSheet
        open={actionsSheetOpen}
        onOpenChange={setActionsSheetOpen}
        itemName={item.style.name || item.style_id}
        status={listingStatus}
        canListOnStockX={canListOnStockX}
        onViewMarket={handleCardClick}
        onListOnStockX={onListOnStockX}
        onRepriceListing={onRepriceListing}
        onPauseListing={onDeactivateListing}
        onActivateListing={onReactivateListing}
        onDeleteItem={onDelete}
      />
    </>
  )
}
