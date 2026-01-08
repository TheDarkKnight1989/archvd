'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { PlainMoneyCell } from '@/lib/format/money'
import { generateProductSlug } from '@/lib/utils/slug'
import { MobileItemActionsSheet } from './MobileItemActionsSheet'
import type { EnrichedLineItem } from '@/lib/portfolio/types'
import type { InventoryV4Listing } from '@/lib/inventory-v4/types'

interface MobileInventoryItemCardProps {
  item: EnrichedLineItem
  isSelected: boolean
  onSelectionChange: (checked: boolean) => void
  onListOnStockX?: () => void
  onRepriceListing?: () => void
  onDeactivateListing?: () => void
  onReactivateListing?: () => void
  onDeleteItem?: () => void
}

export function MobileInventoryItemCard({
  item,
  isSelected,
  onSelectionChange,
  onListOnStockX,
  onRepriceListing,
  onDeactivateListing,
  onReactivateListing,
  onDeleteItem,
}: MobileInventoryItemCardProps) {
  const router = useRouter()
  const { convert, currency, symbol } = useCurrency()
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)

  // V4: Extract StockX listing from adapter (source of truth)
  const v4StockxListing = (item as { _v4StockxListing?: InventoryV4Listing | null })._v4StockxListing ?? null

  // Derive status from V4 listing (source of truth)
  const status = useMemo(() => {
    if (!v4StockxListing) return 'Unlisted'
    if (v4StockxListing.status === 'active') return 'Listed'
    if (v4StockxListing.status === 'paused') return 'Paused'
    return 'Unlisted'
  }, [v4StockxListing])

  // Status badge styling
  const statusBadge = useMemo(() => {
    if (status === 'Listed') {
      return {
        label: 'Listed',
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-semibold shadow-sm shadow-emerald-500/10',
      }
    }
    if (status === 'Paused') {
      return {
        label: 'Paused',
        className: 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-semibold shadow-sm shadow-amber-400/10',
      }
    }
    return {
      label: 'Unlisted',
      className: 'bg-muted/10 text-muted border-muted/30',
    }
  }, [status])

  // Generate market page URL
  const productName = `${item.brand || ''} ${item.model || ''}`.trim()
  const slug = item.sku ? generateProductSlug(productName, item.sku) : null
  const marketUrl = slug ? `/portfolio/market/${slug}?itemId=${item.id}` : `/portfolio/inventory/market/${item.id}`

  // Format values
  const purchasePrice = item.invested ? convert(item.invested, 'GBP') : null
  const marketPrice = item.market?.price ? convert(item.market.price, item.market.currency || 'GBP') : null
  const listedPrice = item.stockx?.askPrice
  const pl = item.pl !== null && item.pl !== undefined ? convert(item.pl, 'GBP') : null
  const performancePct = item.performancePct

  // Handle card click (navigate to market page)
  const handleCardClick = () => {
    router.push(marketUrl)
  }

  // Can list on StockX if mapped and not already listed (V4 source of truth)
  const canListOnStockX = !!item.stockx?.mapped && !v4StockxListing

  // Last synced info
  const lastSyncText = useMemo(() => {
    const timestamp = item.stockx?.lastSyncSuccessAt
    if (!timestamp) return 'Never synced'

    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  }, [item.stockx?.lastSyncSuccessAt])

  return (
    <>
      <div
        className={cn(
          'relative bg-gradient-to-br from-elev-1 to-elev-1/80 rounded-xl border-2 transition-all duration-200 overflow-hidden',
          isSelected
            ? 'border-[#00FF94]/60 shadow-lg shadow-[#00FF94]/10'
            : 'border-[#00FF94]/10'
        )}
      >
        {/* Card Content with padding */}
        <div className="p-4">
          {/* Top Row: Checkbox + Image + Basic Info + Menu */}
          <div className="flex items-start gap-3 mb-3">
            {/* Checkbox */}
            <div className="flex items-center pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectionChange}
                aria-label={`Select ${item.sku}`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Tappable Card Content */}
            <button
              onClick={handleCardClick}
              className="flex-1 flex items-start gap-3 text-left min-w-0"
            >
              {/* Product Image */}
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-elev-2 border border-border/40">
                  {item.image?.url ? (
                    <img
                      src={item.image.url}
                      alt={item.image.alt || `${item.brand} ${item.model}`}
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
                  {(() => {
                    // MANUAL ITEM FIX: Detect manual items - show title only, no brand concatenation
                    const isManual = !item.stockx_product_id && !item.alias_catalog_id
                    const displayTitle = item.model?.trim() || item.sku?.trim() || 'Untitled'

                    if (isManual) {
                      // Manual items: just show the title
                      return displayTitle
                    } else {
                      // Regular items: show brand + model, avoiding duplication
                      const brand = item.brand?.trim() || ''
                      return displayTitle.toLowerCase().startsWith(brand.toLowerCase())
                        ? displayTitle
                        : brand ? `${brand} ${displayTitle}`.trim() : displayTitle
                    }
                  })()}
                </h3>
                <p className="text-[11px] text-white/55 mono mb-1 leading-tight">{item.sku}</p>
                <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
                  {statusBadge.label}
                </Badge>
              </div>
            </button>

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

          {/* Middle Row: Financial Data (2 columns with visual separator) */}
          <button
            onClick={handleCardClick}
            className="w-full text-left"
          >
            <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-border/30">
              {/* Left Column */}
              <div className="space-y-2.5 pr-3 border-r border-soft/20">
                <div>
                  {/* MANUAL ITEM FIX: For manual items with size="OS", show "Size" instead of "Size UK" */}
                  <div className="text-[11px] text-muted/70 mb-0.5">
                    {(() => {
                      const isManual = !item.stockx_product_id && !item.alias_catalog_id
                      return isManual && item.size_uk === 'OS' ? 'Size' : 'Size UK'
                    })()}
                  </div>
                  <div className="text-xs font-medium mono tabular-nums text-fg leading-tight">
                    {item.size_uk || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Purchase {symbol()}</div>
                  <div className="text-xs font-medium mono tabular-nums text-fg leading-tight">
                    <PlainMoneyCell value={purchasePrice} currency={currency} />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Listed {symbol()}</div>
                  <div className={cn(
                    'text-xs font-medium mono tabular-nums leading-tight',
                    listedPrice ? 'text-emerald-500' : 'text-muted'
                  )}>
                    {listedPrice ? (
                      <PlainMoneyCell value={listedPrice} currency={currency} />
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2.5 pl-2">
                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Market {symbol()}</div>
                  <div className="text-xs font-medium mono tabular-nums text-fg leading-tight">
                    <PlainMoneyCell value={marketPrice} currency={currency} />
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Unrealised P/L {symbol()}</div>
                  <div
                    className={cn(
                      'text-xs font-semibold mono tabular-nums leading-tight',
                      pl !== null && pl > 0 ? 'text-emerald-500' : pl !== null && pl < 0 ? 'text-red-500' : 'text-muted'
                    )}
                  >
                    {pl !== null ? (
                      <>
                        {pl > 0 && '+'}
                        {symbol()}
                        {Math.abs(pl).toFixed(2)}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted/70 mb-0.5">Performance</div>
                  <div className="text-xs font-semibold mono tabular-nums flex items-center gap-1.5 leading-tight">
                    {performancePct !== null && performancePct !== undefined ? (
                      <>
                        {performancePct > 0 ? (
                          <>
                            <TrendingUp className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                            <span className="text-emerald-500">
                              +{performancePct.toFixed(1)}%
                            </span>
                          </>
                        ) : performancePct < 0 ? (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />
                            <span className="text-red-500">
                              {performancePct.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">0.0%</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* Bottom Row: Meta Info */}
          <button
            onClick={handleCardClick}
            className="w-full flex items-center justify-between text-[10px] text-muted/60"
          >
            <div>Last sync: {lastSyncText}</div>
            <div>Source: StockX</div>
          </button>
        </div>
      </div>

      {/* Mobile Actions Sheet */}
      <MobileItemActionsSheet
        open={actionsSheetOpen}
        onOpenChange={setActionsSheetOpen}
        itemName={`${item.brand} ${item.model}`}
        status={status}
        canListOnStockX={canListOnStockX}
        onViewMarket={handleCardClick}
        onListOnStockX={onListOnStockX}
        onRepriceListing={onRepriceListing}
        onPauseListing={onDeactivateListing}
        onActivateListing={onReactivateListing}
        onDeleteItem={onDeleteItem}
      />
    </>
  )
}
