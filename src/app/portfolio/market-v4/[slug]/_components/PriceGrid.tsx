'use client'

/**
 * PriceGrid - Size-based price comparison grid
 *
 * Tabs: Asks, Bids, Sales
 * Shows prices per size from StockX and Alias
 */

import type { SizeGridRow, SizeGridTab } from '@/hooks/useMarketPageData'

interface PriceGridProps {
  data: SizeGridRow[] | null
  loading?: boolean
  activeTab: SizeGridTab
  onTabChange: (tab: SizeGridTab) => void
  currencySymbol?: string
}

const TABS: { id: SizeGridTab; label: string }[] = [
  { id: 'asks', label: 'Asks' },
  { id: 'bids', label: 'Bids' },
  { id: 'sales', label: 'Sales' },
]

export function PriceGrid({
  data,
  loading,
  activeTab,
  onTabChange,
  currencySymbol = '$',
}: PriceGridProps) {
  if (loading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b bg-muted/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground'
              }`}
              disabled
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Loading skeleton */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Tab header */}
        <div className="flex border-b bg-muted/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-8 text-center text-muted-foreground text-sm">
          No price data available
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b bg-muted/30">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid content */}
      <div className="p-3">
        {activeTab === 'asks' && (
          <AsksGrid data={data} currencySymbol={currencySymbol} />
        )}
        {activeTab === 'bids' && (
          <BidsGrid data={data} currencySymbol={currencySymbol} />
        )}
        {activeTab === 'sales' && (
          <SalesGrid data={data} currencySymbol={currencySymbol} />
        )}
      </div>
    </div>
  )
}

// Asks tab - show lowest ask per size
function AsksGrid({ data, currencySymbol }: { data: SizeGridRow[]; currencySymbol: string }) {
  const filtered = data.filter(row => row.stockxAsk != null || row.aliasAsk != null)

  if (filtered.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-6">No asks available</div>
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {filtered.map((row) => {
        const best = getBestAsk(row)
        return (
          <SizeCard
            key={row.size}
            size={row.size}
            price={best?.price}
            provider={best?.provider}
            secondaryPrice={getSecondaryAsk(row, best?.provider)}
            currencySymbol={currencySymbol}
          />
        )
      })}
    </div>
  )
}

// Bids tab - show highest bid per size
function BidsGrid({ data, currencySymbol }: { data: SizeGridRow[]; currencySymbol: string }) {
  const filtered = data.filter(row => row.stockxBid != null || row.aliasBid != null)

  if (filtered.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-6">No bids available</div>
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {filtered.map((row) => {
        const best = getBestBid(row)
        return (
          <SizeCard
            key={row.size}
            size={row.size}
            price={best?.price}
            provider={best?.provider}
            secondaryPrice={getSecondaryBid(row, best?.provider)}
            currencySymbol={currencySymbol}
            isBid
          />
        )
      })}
    </div>
  )
}

// Sales tab - show last sale per size
function SalesGrid({ data, currencySymbol }: { data: SizeGridRow[]; currencySymbol: string }) {
  const filtered = data.filter(row => row.lastSale != null)

  if (filtered.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-6">No sales available</div>
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {filtered.map((row) => (
        <SizeCard
          key={row.size}
          size={row.size}
          price={row.lastSale?.price}
          sublabel={row.lastSale?.date ? formatRelativeDate(row.lastSale.date) : undefined}
          currencySymbol={currencySymbol}
          isSale
        />
      ))}
    </div>
  )
}

// Individual size card
interface SizeCardProps {
  size: string
  price?: number | null
  provider?: 'stockx' | 'alias'
  secondaryPrice?: number | null
  sublabel?: string
  currencySymbol: string
  isBid?: boolean
  isSale?: boolean
}

function SizeCard({
  size,
  price,
  provider,
  secondaryPrice,
  sublabel,
  currencySymbol,
  isBid,
  isSale,
}: SizeCardProps) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
      <div className="text-xs text-muted-foreground mb-1">{size}</div>
      <div
        className={`text-sm font-mono font-medium ${
          isSale
            ? 'text-foreground'
            : isBid
            ? 'text-green-600'
            : 'text-foreground'
        }`}
      >
        {price != null ? `${currencySymbol}${Math.round(price)}` : '-'}
      </div>
      {provider && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {provider === 'stockx' ? 'StockX' : 'Alias'}
        </div>
      )}
      {sublabel && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {sublabel}
        </div>
      )}
      {secondaryPrice != null && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {currencySymbol}{Math.round(secondaryPrice)}
        </div>
      )}
    </div>
  )
}

// Helper functions
function getBestAsk(row: SizeGridRow): { price: number; provider: 'stockx' | 'alias' } | null {
  const asks: { price: number; provider: 'stockx' | 'alias' }[] = []
  if (row.stockxAsk != null) asks.push({ price: row.stockxAsk, provider: 'stockx' })
  if (row.aliasAsk != null) asks.push({ price: row.aliasAsk, provider: 'alias' })
  if (asks.length === 0) return null
  return asks.reduce((min, curr) => (curr.price < min.price ? curr : min))
}

function getBestBid(row: SizeGridRow): { price: number; provider: 'stockx' | 'alias' } | null {
  const bids: { price: number; provider: 'stockx' | 'alias' }[] = []
  if (row.stockxBid != null) bids.push({ price: row.stockxBid, provider: 'stockx' })
  if (row.aliasBid != null) bids.push({ price: row.aliasBid, provider: 'alias' })
  if (bids.length === 0) return null
  return bids.reduce((max, curr) => (curr.price > max.price ? curr : max))
}

function getSecondaryAsk(row: SizeGridRow, primaryProvider?: 'stockx' | 'alias'): number | null {
  if (primaryProvider === 'stockx' && row.aliasAsk != null) return row.aliasAsk
  if (primaryProvider === 'alias' && row.stockxAsk != null) return row.stockxAsk
  return null
}

function getSecondaryBid(row: SizeGridRow, primaryProvider?: 'stockx' | 'alias'): number | null {
  if (primaryProvider === 'stockx' && row.aliasBid != null) return row.aliasBid
  if (primaryProvider === 'alias' && row.stockxBid != null) return row.stockxBid
  return null
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
