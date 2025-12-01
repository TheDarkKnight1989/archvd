'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { PlainMoneyCell, PercentCell } from '@/lib/format/money'
import { generateProductSlug } from '@/lib/utils/slug'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

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

  // Derive status from StockX listing
  const status = useMemo(() => {
    const stockxStatus = item.stockx?.listingStatus
    if (stockxStatus === 'ACTIVE' || stockxStatus === 'PENDING') return 'Listed'
    if (stockxStatus === 'INACTIVE') return 'Paused'
    return 'Unlisted'
  }, [item.stockx?.listingStatus])

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
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking checkbox or actions menu
    const target = e.target as HTMLElement
    if (
      target.closest('[data-no-navigate]') ||
      target.closest('button') ||
      target.closest('[role="checkbox"]')
    ) {
      return
    }
    router.push(marketUrl)
  }

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
    <div
      className={cn(
        'relative bg-gradient-to-br from-elev-1 to-elev-1/80 rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-[#00FF94]/60 shadow-lg shadow-[#00FF94]/10'
          : 'border-[#00FF94]/10 hover:border-[#00FF94]/30 hover:shadow-md'
      )}
      onClick={handleCardClick}
    >
      {/* Top Row: Checkbox + Image + Basic Info + Status */}
      <div className="flex items-start gap-3 mb-3">
        {/* Checkbox */}
        <div className="flex items-center pt-1" data-no-navigate>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelectionChange}
            aria-label={`Select ${item.sku}`}
          />
        </div>

        {/* Product Image */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-elev-2 border border-border/40">
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
          <h3 className="text-sm font-semibold text-fg line-clamp-2 mb-1">
            {item.brand} {item.model}
          </h3>
          <p className="text-xs text-muted mono mb-1">{item.sku}</p>
          <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
            {statusBadge.label}
          </Badge>
        </div>

        {/* Actions Menu */}
        <div data-no-navigate>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 hover:bg-elev-2 rounded-lg transition-colors"
                aria-label="Item actions"
              >
                <MoreVertical className="h-5 w-5 text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[200px] bg-[#0E1A15] border-[#15251B] p-2 shadow-xl"
              align="end"
            >
              <DropdownMenuItem
                onClick={() => router.push(marketUrl)}
                className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
              >
                View market
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />

              {/* List on StockX - if not listed */}
              {status === 'Unlisted' && item.stockx?.mapped && onListOnStockX && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onListOnStockX()
                  }}
                  className="text-[#00FF94] hover:bg-[#00FF94]/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  List on StockX
                </DropdownMenuItem>
              )}

              {/* Reprice - if listed */}
              {(status === 'Listed' || status === 'Paused') && onRepriceListing && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onRepriceListing()
                  }}
                  className="text-[#E8F6EE] hover:bg-[#0B1510] rounded-lg px-3 py-2 cursor-pointer"
                >
                  Reprice on StockX
                </DropdownMenuItem>
              )}

              {/* Pause - if active */}
              {status === 'Listed' && onDeactivateListing && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeactivateListing()
                  }}
                  className="text-yellow-400 hover:bg-yellow-500/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  Pause on StockX
                </DropdownMenuItem>
              )}

              {/* Activate - if paused */}
              {status === 'Paused' && onReactivateListing && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onReactivateListing()
                  }}
                  className="text-emerald-400 hover:bg-emerald-500/10 rounded-lg px-3 py-2 cursor-pointer"
                >
                  Activate on StockX
                </DropdownMenuItem>
              )}

              {onDeleteItem && (
                <>
                  <DropdownMenuSeparator className="bg-[#15251B]/40 my-1" />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem()
                    }}
                    className="text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    Delete item
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Middle Row: Financial Data (2 columns) */}
      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-border/30">
        {/* Left Column */}
        <div className="space-y-2">
          <div>
            <div className="text-xs text-muted mb-0.5">Size UK</div>
            <div className="text-sm font-medium mono tabular-nums text-fg">
              {item.size_uk || '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-0.5">Purchase {symbol()}</div>
            <div className="text-sm font-medium mono tabular-nums text-fg">
              <PlainMoneyCell value={purchasePrice} currency={currency} />
            </div>
          </div>

          {listedPrice && (
            <div>
              <div className="text-xs text-muted mb-0.5">Listed {symbol()}</div>
              <div className="text-sm font-medium mono tabular-nums text-emerald-500">
                <PlainMoneyCell value={listedPrice} currency={currency} />
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-2">
          <div>
            <div className="text-xs text-muted mb-0.5">Market {symbol()}</div>
            <div className="text-sm font-medium mono tabular-nums text-fg">
              <PlainMoneyCell value={marketPrice} currency={currency} />
            </div>
          </div>

          <div>
            <div className="text-xs text-muted mb-0.5">Unrealised P/L {symbol()}</div>
            <div
              className={cn(
                'text-sm font-semibold mono tabular-nums',
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
            <div className="text-xs text-muted mb-0.5">Performance</div>
            <div className="text-sm font-semibold mono tabular-nums flex items-center gap-1">
              {performancePct !== null && performancePct !== undefined ? (
                <>
                  <span className={cn(
                    performancePct > 0 ? 'text-emerald-500' : performancePct < 0 ? 'text-red-500' : 'text-muted'
                  )}>
                    {performancePct > 0 ? '+' : ''}{performancePct.toFixed(1)}%
                  </span>
                  {performancePct > 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : performancePct < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : null}
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Meta Info */}
      <div className="flex items-center justify-between text-xs text-muted">
        <div>Last sync: {lastSyncText}</div>
        <div>Source: StockX</div>
      </div>
    </div>
  )
}
