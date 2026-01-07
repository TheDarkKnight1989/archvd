'use client'

/**
 * KeyStatsRow - Mobile-first key market stats
 *
 * Shows: Last Sale, Lowest Ask, Highest Bid, Market Price
 * Horizontally scrollable on mobile
 */

import type { KeyStats } from '@/hooks/useMarketPageData'

interface KeyStatsRowProps {
  stats: KeyStats | null
  loading?: boolean
  currencySymbol?: string
}

export function KeyStatsRow({ stats, loading, currencySymbol = '$' }: KeyStatsRowProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-28 bg-muted rounded-lg p-3 animate-pulse"
          >
            <div className="h-3 bg-muted-foreground/20 rounded w-16 mb-2" />
            <div className="h-6 bg-muted-foreground/20 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      label: 'Last Sale',
      value: stats?.lastSale?.price,
      sublabel: stats?.lastSale?.date
        ? formatDate(stats.lastSale.date)
        : null,
    },
    {
      label: 'Lowest Ask',
      value: stats?.lowestAsk?.price,
      sublabel: stats?.lowestAsk?.provider
        ? stats.lowestAsk.provider === 'stockx' ? 'StockX' : 'Alias'
        : null,
      highlight: true,
    },
    {
      label: 'Highest Bid',
      value: stats?.highestBid?.price,
      sublabel: stats?.highestBid?.provider
        ? stats.highestBid.provider === 'stockx' ? 'StockX' : 'Alias'
        : null,
    },
    {
      label: 'Market',
      value: stats?.marketPrice,
      sublabel: '7d avg',
    },
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {statCards.map((card) => (
        <div
          key={card.label}
          className={`flex-shrink-0 min-w-[100px] rounded-lg p-3 ${
            card.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted'
          }`}
        >
          <div className="text-xs text-muted-foreground">{card.label}</div>
          <div className="text-lg font-bold font-mono mt-0.5">
            {card.value != null ? (
              `${currencySymbol}${Math.round(card.value)}`
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          {card.sublabel && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {card.sublabel}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
