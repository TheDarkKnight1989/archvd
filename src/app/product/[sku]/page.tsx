'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Heart, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkline } from '@/components/ui/sparkline'
import { AddFromSearchModal } from '@/components/modals/AddFromSearchModal'
import { AddToWatchlistModal } from '@/components/modals/AddToWatchlistModal'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { useToast } from '@/contexts/ToastContext'

interface ProductPageProps {
  params: Promise<{ sku: string }>
}

export default function ProductPage({ params }: ProductPageProps) {
  const router = useRouter()
  const { currency, format } = useCurrency()
  const toast = useToast()
  const [sku, setSku] = useState<string>('')
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [seriesData, setSeriesData] = useState<number[]>([])
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedWatchlistProduct, setSelectedWatchlistProduct] = useState<any>(null)
  const [stockxMarketData, setStockxMarketData] = useState<any>(null)
  const [stockxLoading, setStockxLoading] = useState(false)
  const [stockxError, setStockxError] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSku(p.sku.toUpperCase()))
  }, [params])

  // Fetch product data
  useEffect(() => {
    if (!sku) return

    const fetchProduct = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/market/${sku}?currency=${currency}`)
        if (!res.ok) {
          throw new Error('Product not found')
        }
        const data = await res.json()
        setProduct(data)

        // Fetch series data for sparkline
        const seriesRes = await fetch(`/api/market/${sku}/series?days=30&currency=${currency}`)
        if (seriesRes.ok) {
          const seriesData = await seriesRes.json()
          setSeriesData(seriesData.series?.map((s: any) => s.value) || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [sku, currency])

  // Fetch StockX market data when tab is active
  useEffect(() => {
    if (!sku || activeTab !== 'market-stockx') return

    const fetchStockxMarket = async () => {
      setStockxLoading(true)
      setStockxError(null)

      try {
        const res = await fetch(`/api/stockx/products/${sku}/market?currency=${currency}`)
        if (!res.ok) {
          throw new Error('Failed to fetch StockX market data')
        }
        const data = await res.json()
        setStockxMarketData(data)
      } catch (err: any) {
        setStockxError(err.message)
      } finally {
        setStockxLoading(false)
      }
    }

    fetchStockxMarket()
  }, [sku, currency, activeTab])

  // Action handlers
  const handleAddToPortfolio = () => {
    if (!product) return

    const { catalog, latest, category } = product
    const isPokemon = category === 'pokemon'

    setSelectedProduct({
      sku: catalog.sku,
      brand: isPokemon ? 'Pokémon' : catalog.brand,
      model: isPokemon ? catalog.name : catalog.model,
      colorway: isPokemon ? `${catalog.set_name} • ${catalog.language}` : catalog.colorway,
      imageUrl: catalog.image_url,
      latestPrice: latest ? {
        price: latest.median,
        currency: currency,
        asOf: new Date().toISOString(),
        source: 'market',
      } : null,
    })
    setAddModalOpen(true)
  }

  const handleAddToWatchlist = () => {
    if (!product) return

    const isPokemon = category === 'pokemon'
    const productName = isPokemon ? catalog.name : `${catalog.brand} ${catalog.model}`

    setSelectedWatchlistProduct({
      sku: catalog.sku,
      name: productName,
      subtitle: isPokemon ? `${catalog.set_name} • ${catalog.language}` : catalog.colorway,
      imageUrl: catalog.image_url,
      latestPrice: latest?.median || null,
    })
    setWatchlistModalOpen(true)
  }

  const handleWatchlistSuccess = () => {
    setSelectedWatchlistProduct(null)
  }

  const handleAddSuccess = () => {
    setSelectedProduct(null)
    // Optionally navigate to inventory or show success message
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elev-1">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted text-sm">Loading product details...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-elev-1">
        <div className="text-center">
          <p className="text-fg text-lg font-semibold mb-2">Product Not Found</p>
          <p className="text-muted text-sm mb-6">{error || 'This product does not exist in our catalog.'}</p>
          <Button onClick={() => router.push('/portfolio')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portfolio
          </Button>
        </div>
      </div>
    )
  }

  const { catalog, latest, category } = product
  const isPokemon = category === 'pokemon'

  // Calculate price change for badge
  const priceChange = seriesData.length >= 2
    ? ((seriesData[seriesData.length - 1] - seriesData[0]) / seriesData[0]) * 100
    : 0
  const priceChangePositive = priceChange > 0

  return (
    <div className="min-h-screen bg-elev-1">
      {/* Header with Back Button */}
      <div className="border-b border-border/30 bg-elev-2/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Product Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Product Image */}
          <div className="flex-shrink-0">
            <div className={cn(
              "relative w-full lg:w-[400px] aspect-square rounded-2xl overflow-hidden",
              "bg-elev-2 border border-border/20",
              "shadow-[0_0_32px_rgba(0,255,148,0.1)]"
            )}>
              {catalog.image_url ? (
                <img
                  src={catalog.image_url}
                  alt={isPokemon ? catalog.name : catalog.model}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 space-y-6">
            {/* Title & SKU */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-3xl md:text-4xl font-cinzel font-bold text-fg">
                  {isPokemon ? catalog.name : `${catalog.brand} ${catalog.model}`}
                </h1>
              </div>
              {isPokemon && (
                <p className="text-muted text-lg mb-3">
                  {catalog.set_name} • {catalog.language}
                </p>
              )}
              {!isPokemon && catalog.colorway && (
                <p className="text-muted text-lg mb-3">{catalog.colorway}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-mono text-sm">
                  {catalog.sku}
                </Badge>
                {isPokemon && catalog.sealed_type && (
                  <Badge variant="outline" className="capitalize">
                    {catalog.sealed_type.replace(/_/g, ' ')}
                  </Badge>
                )}
                {!isPokemon && catalog.release_date && (
                  <Badge variant="outline">
                    Released {new Date(catalog.release_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Market Summary */}
            {latest && (
              <div className={cn(
                "p-6 bg-elev-2 rounded-2xl border border-border/20",
                "shadow-[0_0_16px_rgba(0,255,148,0.08)]"
              )}>
                <h2 className="font-cinzel text-accent uppercase tracking-wider text-xs mb-4">
                  Market Summary
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Median</p>
                    <p className="text-2xl font-mono font-bold text-fg tabular-nums">
                      {format(latest.median)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Low</p>
                    <p className="text-2xl font-mono font-bold text-fg tabular-nums">
                      {format(latest.min)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">High</p>
                    <p className="text-2xl font-mono font-bold text-fg tabular-nums">
                      {format(latest.max)}
                    </p>
                  </div>
                </div>

                {/* 30-day Sparkline */}
                {seriesData.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/20">
                    <div className="flex items-center gap-3">
                      <Sparkline
                        data={seriesData}
                        width={120}
                        height={32}
                        color={priceChangePositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                      />
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-mono tabular-nums px-2 py-0.5",
                          priceChangePositive
                            ? "text-success border-success/40 bg-success/10"
                            : "text-danger border-danger/40 bg-danger/10"
                        )}
                      >
                        {priceChangePositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {priceChangePositive ? '+' : ''}{priceChange.toFixed(1)}%
                      </Badge>
                    </div>
                    <span className="text-xs text-muted">Last 30 days</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAddToPortfolio}
                className={cn(
                  "bg-accent text-black hover:bg-accent/90",
                  "hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-200"
                )}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Portfolio
              </Button>
              <Button
                variant="outline"
                onClick={handleAddToWatchlist}
                className="border-border/40 hover:border-accent/40 hover:bg-elev-1"
              >
                <Heart className="h-4 w-4 mr-2" />
                Add to Watchlist
              </Button>
            </div>
          </div>
        </div>

        {/* Analytics Tabs */}
        <div className="mt-12">
          <div className="border-b border-border/20">
            <nav className="flex space-x-8">
              {['overview', 'market-data', 'market-stockx', 'portfolio', 'history'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "pb-3 px-1 border-b-2 transition-all duration-120",
                    "font-cinzel uppercase tracking-wider text-xs",
                    activeTab === tab
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-fg"
                  )}
                >
                  {tab.replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-8">
            {activeTab === 'overview' && (
              <div className="text-center py-12 text-muted">
                Overview content coming soon...
              </div>
            )}
            {activeTab === 'market-data' && (
              <div className="text-center py-12 text-muted">
                Market data content coming soon...
              </div>
            )}
            {activeTab === 'market-stockx' && (
              <div>
                {stockxLoading && (
                  <div className="text-center py-12">
                    <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted text-sm">Loading StockX market data...</p>
                  </div>
                )}

                {stockxError && !stockxLoading && (
                  <div className="text-center py-12">
                    <p className="text-danger text-sm mb-2">Failed to load StockX data</p>
                    <p className="text-muted text-xs">{stockxError}</p>
                  </div>
                )}

                {!stockxLoading && !stockxError && stockxMarketData && (
                  <div>
                    {/* Header with provenance */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-cinzel text-accent uppercase tracking-wider text-xs">
                          Market Data by Size
                        </h3>
                        {stockxMarketData.as_of && (
                          <p className="text-[10px] text-muted mt-1">
                            StockX • as of {new Date(stockxMarketData.as_of).toLocaleString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#00B359]/20 border border-[#00B359]/30">
                        <div className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#00B359]/30 text-[#00B359] text-xs font-bold mr-2">
                          Sx
                        </div>
                        <span className="text-xs font-medium text-[#00B359]">StockX</span>
                      </div>
                    </div>

                    {/* Per-size pricing grid */}
                    {stockxMarketData.sizes && stockxMarketData.sizes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/20">
                              <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider">UK Size</th>
                              <th className="text-right py-3 px-4 text-xs text-muted uppercase tracking-wider">Lowest Ask</th>
                              <th className="text-right py-3 px-4 text-xs text-muted uppercase tracking-wider">Highest Bid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockxMarketData.sizes.map((sizeData: any, idx: number) => (
                              <tr
                                key={idx}
                                className={cn(
                                  "border-b border-border/10 transition-colors",
                                  "hover:bg-elev-2/30"
                                )}
                              >
                                <td className="py-3 px-4">
                                  <span className="text-sm font-medium text-fg">{sizeData.size}</span>
                                </td>
                                <td className="text-right py-3 px-4">
                                  <span className="text-sm font-mono text-success tabular-nums">
                                    {sizeData.lowest_ask ? format(sizeData.lowest_ask) : '—'}
                                  </span>
                                </td>
                                <td className="text-right py-3 px-4">
                                  <span className="text-sm font-mono text-accent tabular-nums">
                                    {sizeData.highest_bid ? format(sizeData.highest_bid) : '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted text-sm">
                        No StockX market data available for this product
                      </div>
                    )}

                    {/* Note about mock mode */}
                    {stockxMarketData.mock && (
                      <div className="mt-6 p-4 bg-elev-2/50 border border-border/20 rounded-lg">
                        <p className="text-xs text-muted">
                          <span className="font-semibold text-accent">Mock Mode:</span> This is sample data. Connect StockX in Settings to see live market prices.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {!stockxLoading && !stockxError && !stockxMarketData && (
                  <div className="text-center py-12 text-muted text-sm">
                    No StockX market data available
                  </div>
                )}
              </div>
            )}
            {activeTab === 'portfolio' && (
              <div className="text-center py-12 text-muted">
                Portfolio holdings content coming soon...
              </div>
            )}
            {activeTab === 'history' && (
              <div className="text-center py-12 text-muted">
                Price history content coming soon...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add From Search Modal */}
      <AddFromSearchModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        product={selectedProduct}
        onSuccess={handleAddSuccess}
      />

      {/* Add to Watchlist Modal */}
      <AddToWatchlistModal
        open={watchlistModalOpen}
        onOpenChange={setWatchlistModalOpen}
        product={selectedWatchlistProduct}
        onSuccess={handleWatchlistSuccess}
      />
    </div>
  )
}
