'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Search, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { gbp2 } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

type MarketPrice = {
  size: string
  source: string
  price: number
  currency: string
  as_of: string
  meta?: any
}

type ProductData = {
  sku: string
  brand?: string
  model?: string
  colorway?: string
  image_url?: string
  release_date?: string
  retail_price?: number
  meta?: any
}

type MarketData = {
  catalog: ProductData | null
  prices: MarketPrice[]
  sources: string[]
}

export default function MarketPage() {
  useRequireAuth()

  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle SKU from URL query parameter
  useEffect(() => {
    const skuParam = searchParams?.get('sku')
    if (skuParam) {
      const normalizedSku = skuParam.trim().toUpperCase()
      setSearchInput(normalizedSku)
      // Auto-search
      performSearch(normalizedSku)
    }
  }, [searchParams])

  const performSearch = async (sku: string) => {
    setLoading(true)
    setError(null)
    setMarketData(null)

    try {
      const response = await fetch(`/api/market/${sku}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch market data')
      }

      setMarketData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch market data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    const sku = searchInput.trim().toUpperCase()

    if (!sku) {
      setError('Please enter a SKU')
      return
    }

    performSearch(sku)
  }

  const formatRelativeTime = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="mx-auto max-w-[1280px] px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 text-fg">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-fg relative inline-block">
          Market
          <span className="absolute bottom-0 left-0 w-16 h-0.5 bg-accent-400 opacity-40"></span>
        </h1>
        <p className="text-sm text-dim mt-1">Live market prices per size from StockX, Laced, and more</p>
      </div>

      {/* Search Bar */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim" />
            <Input
              placeholder="Enter SKU (e.g. DZ5485-001)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 bg-bg border-border font-mono"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !searchInput.trim()}
            className="bg-accent text-black hover:bg-accent-600"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="p-6 border-danger/50 bg-danger/10">
          <p className="text-danger font-medium">{error}</p>
        </Card>
      )}

      {/* Results */}
      {marketData && (
        <div className="space-y-4">
          {/* Product Info */}
          {marketData.catalog && (
            <Card className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {marketData.catalog.image_url && (
                  <img
                    src={marketData.catalog.image_url}
                    alt={marketData.catalog.model || marketData.catalog.sku}
                    className="w-full md:w-48 h-48 object-cover rounded-xl"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-fg">
                        {marketData.catalog.brand} {marketData.catalog.model}
                      </h2>
                      {marketData.catalog.colorway && (
                        <p className="text-sm text-muted mt-1">{marketData.catalog.colorway}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {marketData.catalog.sku}
                    </Badge>
                  </div>

                  {marketData.catalog.retail_price && (
                    <p className="text-sm text-dim">
                      Retail: <span className="font-mono text-fg">{gbp2.format(marketData.catalog.retail_price)}</span>
                    </p>
                  )}

                  {marketData.catalog.release_date && (
                    <p className="text-sm text-dim">
                      Released: {new Date(marketData.catalog.release_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Market Prices Table */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-fg">Market Prices</h3>
                {marketData.sources.length > 0 && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-dim">Sources:</p>
                    {marketData.sources.map((source) => (
                      <Badge key={source} variant="outline" className="text-xs capitalize">
                        {source}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {marketData.prices.length === 0 ? (
              <div className="p-8 text-center text-dim">
                <p className="font-mono text-sm">No market data available for this SKU</p>
                <p className="text-xs mt-2">Try searching for a popular sneaker SKU</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface2 border-b border-border border-t border-t-accent-400/25">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Size
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">
                        Source
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                        vs Retail
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wide">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {marketData.prices.map((price, idx) => {
                      const retailPrice = marketData.catalog?.retail_price || 0
                      const diff = retailPrice > 0 ? price.price - retailPrice : null
                      const diffPct = diff && retailPrice > 0 ? (diff / retailPrice) * 100 : null

                      return (
                        <tr key={idx} className="hover:bg-surface/70 transition-colors">
                          <td className="px-4 py-3 font-mono text-sm text-fg">UK {price.size}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs capitalize">
                              {price.source}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-fg">
                            {gbp2.format(price.price)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {diff !== null && diffPct !== null ? (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 text-sm font-mono',
                                  diff >= 0 ? 'text-success' : 'text-danger'
                                )}
                              >
                                {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {diff >= 0 ? '+' : ''}{gbp2.format(diff)} ({diffPct.toFixed(0)}%)
                              </span>
                            ) : (
                              <span className="text-dim">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-dim font-mono">
                            {formatRelativeTime(price.as_of)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {marketData.prices.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-surface2">
                <p className="text-xs text-dim text-center">
                  Showing {marketData.prices.length} size{marketData.prices.length !== 1 ? 's' : ''} •{' '}
                  <a
                    href={`https://stockx.com/search?s=${marketData.catalog?.sku}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-600 inline-flex items-center gap-1"
                  >
                    View on StockX
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
