'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, TrendingUp, TrendingDown, Loader2, X, Eye, Heart } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkline } from '@/components/ui/sparkline'
import { AddToWatchlistModal } from '@/components/modals/AddToWatchlistModal'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { useToast } from '@/contexts/ToastContext'

interface MarketSearchResult {
  sku: string
  name: string
  subtitle: string
  imageUrl: string
  currency: 'GBP' | 'EUR' | 'USD'
  median: number | null
  delta7dPct: number | null
  series7d: (number | null)[]
  tags: string[]
  sources: { name: 'ebay' | 'tcgplayer'; count: number }[]
  category: 'sneaker' | 'pokemon'
}

type CategoryFilter = 'all' | 'sneakers' | 'pokemon'

interface MarketQuickAddProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProduct?: (result: MarketSearchResult) => void
}

export function MarketQuickAdd({ open, onOpenChange, onSelectProduct }: MarketQuickAddProps) {
  const router = useRouter()
  const { currency, format } = useCurrency()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MarketSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false)
  const [selectedWatchlistProduct, setSelectedWatchlistProduct] = useState<any>(null)
  const [recentlyAddedCount, setRecentlyAddedCount] = useState(0)
  const [showRecentlyAdded, setShowRecentlyAdded] = useState(false)
  const [apiMeta, setApiMeta] = useState<{ duration_ms?: number; cache?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Virtualization state (for >25 results)
  const [scrollTop, setScrollTop] = useState(0)
  const ITEM_HEIGHT = 88 // Height of each result row in pixels
  const VISIBLE_ITEMS = 8 // Number of items to render at once
  const BUFFER_ITEMS = 3 // Extra items to render above/below visible area

  // Focus input when dialog opens + restore last query
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)

      // Restore last query from sessionStorage
      const lastQuery = sessionStorage.getItem('market_search_last_query')
      if (lastQuery) {
        setQuery(lastQuery)
      }
    } else {
      // Save query to sessionStorage when closing
      if (query) {
        sessionStorage.setItem('market_search_last_query', query)
      }
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open, query])

  // Search with debounce, abort previous requests, and retry logic
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const timer = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Retry logic with exponential backoff
      const MAX_RETRIES = 3
      const RETRY_DELAY_MS = 500

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(
            `/api/market/search?q=${encodeURIComponent(query)}&currency=${currency}`,
            {
              signal: controller.signal,
              headers: { 'Content-Type': 'application/json' }
            }
          )

          if (!res.ok) {
            // Don't retry on 4xx errors (client errors)
            if (res.status >= 400 && res.status < 500) {
              console.error(`Search failed with status ${res.status}`)
              setResults([])
              break
            }
            throw new Error(`Search failed with status ${res.status}`)
          }

          const data = await res.json()
          setResults(data.results || [])
          setSelectedIndex(0)

          // Capture API metadata for dev footer
          if (data._meta) {
            setApiMeta(data._meta)
          }

          break // Success, exit retry loop

        } catch (error: any) {
          if (error.name === 'AbortError') {
            // Request was aborted, don't retry
            break
          }

          const isLastAttempt = attempt === MAX_RETRIES
          if (isLastAttempt) {
            console.error('Search error after retries:', error)
            toast.error('Search failed. Please try again.')
            setResults([])
          } else {
            // Wait before retrying with exponential backoff
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      setLoading(false)
    }, 300) // 300ms debounce

    return () => {
      clearTimeout(timer)
      // Clean up abort controller on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, currency, toast])

  // Action handlers
  const handleViewDetails = (result: MarketSearchResult) => {
    router.push(`/product/${result.sku}`)
    onOpenChange(false)
  }

  const handleAddToPortfolio = (result: MarketSearchResult) => {
    onSelectProduct?.(result)

    // Show "Recently added" pill for 3s
    setRecentlyAddedCount(prev => prev + 1)
    setShowRecentlyAdded(true)
    setTimeout(() => setShowRecentlyAdded(false), 3000)

    // Keep overlay open for quick multi-add
  }

  const handleAddToWatchlist = (result: MarketSearchResult) => {
    setSelectedWatchlistProduct({
      sku: result.sku,
      name: result.name,
      subtitle: result.subtitle,
      imageUrl: result.imageUrl,
      latestPrice: result.median,
    })
    setWatchlistModalOpen(true)
    // Keep overlay open for quick multi-add
  }

  const handleWatchlistSuccess = () => {
    setSelectedWatchlistProduct(null)
    // Keep overlay open for quick multi-add
  }

  // Client-side category filtering
  const filteredResults = results.filter(result => {
    if (categoryFilter === 'all') return true
    if (categoryFilter === 'sneakers') return result.category === 'sneaker'
    if (categoryFilter === 'pokemon') return result.category === 'pokemon'
    return true
  })

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [categoryFilter])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredResults.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredResults.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredResults[selectedIndex]) {
            handleAddToPortfolio(filteredResults[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onOpenChange(false)
          break
      }
    },
    [filteredResults, selectedIndex, onOpenChange, handleAddToPortfolio]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Calculate visible range for virtualization (only for >25 results)
  const useVirtualization = filteredResults.length > 25
  const startIndex = useVirtualization
    ? Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS)
    : 0
  const endIndex = useVirtualization
    ? Math.min(filteredResults.length, startIndex + VISIBLE_ITEMS + BUFFER_ITEMS * 2)
    : filteredResults.length
  const visibleResults = useVirtualization ? filteredResults.slice(startIndex, endIndex) : filteredResults
  const offsetY = useVirtualization ? startIndex * ITEM_HEIGHT : 0
  const totalHeight = filteredResults.length * ITEM_HEIGHT

  // Handle scroll for virtualization
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (useVirtualization) {
      setScrollTop(e.currentTarget.scrollTop)
    }
  }, [useVirtualization])

  const selectedResult = filteredResults[selectedIndex]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[900px] w-[90vw] p-0 gap-0 bg-elev-3/95 backdrop-blur-sm",
          "border border-border shadow-[0_0_32px_rgba(0,255,148,0.15)]",
          "animate-in fade-in-0 zoom-in-95 duration-150 rounded-2xl overflow-hidden"
        )}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col lg:flex-row h-[80vh] max-h-[700px]">
          {/* Main Search Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header with Search Input */}
            <div className="sticky top-0 z-10 bg-elev-3/95 backdrop-blur-md border-b border-border/20 p-6 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted pointer-events-none" />
                <Input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products (SKU, name, brand)…"
                  className={cn(
                    "h-14 pl-12 pr-12 text-lg bg-elev-2 border border-border/40 text-fg rounded-xl",
                    "placeholder:text-muted/60 focus:ring-2 focus:ring-accent/40",
                    "focus:shadow-[0_0_16px_rgba(0,255,148,0.2)] transition-all duration-120"
                  )}
                />
                {loading && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-accent animate-spin" />
                )}
                {query && !loading && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted hover:text-fg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Helper Text */}
              {!query && !showRecentlyAdded && (
                <p className="text-xs text-muted mt-3 ml-1">
                  Type at least 2 characters to search sneakers & sealed Pokémon products
                </p>
              )}

              {/* Recently Added Pill */}
              {showRecentlyAdded && (
                <div className="mt-3 ml-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <Badge className="bg-accent/20 text-accent border-accent/40 text-xs font-medium">
                    ✓ Recently added: {recentlyAddedCount} {recentlyAddedCount === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              )}

              {/* Category Filter Chips */}
              {results.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-120",
                      categoryFilter === 'all'
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-elev-1 text-muted border border-border/40 hover:bg-elev-2"
                    )}
                  >
                    All ({results.length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter('sneakers')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-120",
                      categoryFilter === 'sneakers'
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-elev-1 text-muted border border-border/40 hover:bg-elev-2"
                    )}
                  >
                    Sneakers ({results.filter(r => r.category === 'sneaker').length})
                  </button>
                  <button
                    onClick={() => setCategoryFilter('pokemon')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-120",
                      categoryFilter === 'pokemon'
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-elev-1 text-muted border border-border/40 hover:bg-elev-2"
                    )}
                  >
                    Pokémon ({results.filter(r => r.category === 'pokemon').length})
                  </button>
                </div>
              )}
            </div>

            {/* Results List */}
            <div ref={resultsRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
              {/* Loading State - Skeletons */}
              {loading && results.length === 0 && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 bg-elev-2/50 rounded-xl border border-border/20 animate-pulse"
                    >
                      <div className="w-14 h-14 bg-elev-1 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-elev-1 rounded w-3/4" />
                        <div className="h-3 bg-elev-1 rounded w-1/2" />
                      </div>
                      <div className="w-24 h-8 bg-elev-1 rounded" />
                    </div>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!loading && query.length >= 2 && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-elev-2 border border-border/40 flex items-center justify-center mb-4">
                    <Search className="h-7 w-7 text-muted" />
                  </div>
                  <p className="text-fg font-medium mb-1">No products found</p>
                  <p className="text-sm text-muted text-center max-w-sm">
                    Try a different search term or product SKU
                  </p>
                </div>
              )}

              {/* No Results After Filtering */}
              {!loading && query.length >= 2 && results.length > 0 && filteredResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-elev-2 border border-border/40 flex items-center justify-center mb-4">
                    <Search className="h-7 w-7 text-muted" />
                  </div>
                  <p className="text-fg font-medium mb-1">No {categoryFilter} found</p>
                  <p className="text-sm text-muted text-center max-w-sm">
                    Try selecting a different category
                  </p>
                </div>
              )}

              {/* Results */}
              {useVirtualization && (
                <div style={{ height: totalHeight, position: 'relative' }}>
                  <div style={{ transform: `translateY(${offsetY}px)` }}>
                    {visibleResults.map((result, virtualIndex) => {
                      const index = startIndex + virtualIndex
                      const isSelected = index === selectedIndex
                      const deltaPositive = (result.delta7dPct ?? 0) > 0

                      return (
                        <div
                          key={result.sku}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "flex items-center gap-4 p-4 transition-all duration-120 cursor-pointer",
                            "border-b border-border/10 last:border-0",
                            isSelected
                              ? "bg-elev-2 shadow-[inset_3px_0_0_0_rgba(0,255,148,0.7)]"
                              : "hover:bg-elev-2/50"
                          )}
                          style={{ minHeight: `${ITEM_HEIGHT}px` }}
                        >
                    {/* Thumbnail */}
                    {result.imageUrl && (
                      <img
                        src={result.imageUrl}
                        alt={result.name}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border/20"
                      />
                    )}

                    {/* Title & Subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-fg text-base truncate leading-snug">
                        {result.name}
                      </p>
                      <p className="text-sm text-muted truncate mt-0.5">{result.subtitle}</p>
                    </div>

                    {/* Price Block */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Median Price */}
                      {result.median !== null && (
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold text-fg tabular-nums">
                            {format(result.median)}
                          </p>
                        </div>
                      )}

                      {/* Sparkline + Delta */}
                      {(() => {
                        const hasData = result.series7d.some(v => v !== null)

                        if (!hasData) {
                          return (
                            <div className="text-xs text-muted">No recent data</div>
                          )
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <Sparkline
                              data={result.series7d.filter((v): v is number => v !== null)}
                              width={60}
                              height={20}
                              color={deltaPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                            />
                            {result.delta7dPct !== null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-mono tabular-nums px-1.5 py-0.5 h-5",
                                  deltaPositive
                                    ? "text-success border-success/40 bg-success/10"
                                    : "text-danger border-danger/40 bg-danger/10"
                                )}
                              >
                                {deltaPositive ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                {deltaPositive ? '+' : ''}{result.delta7dPct.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted font-mono">—</span>
                            )}
                          </div>
                        )
                      })()}

                      {!result.median && (
                        <span className="text-sm text-muted font-mono">—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Add to Watchlist */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToWatchlist(result)
                        }}
                        className={cn(
                          "h-8 w-8 p-0 text-muted hover:text-accent border border-border/40 hover:border-accent/40",
                          "hover:bg-elev-1 transition-all duration-120"
                        )}
                        title="Add to Watchlist"
                      >
                        <Heart className="h-3.5 w-3.5" />
                      </Button>

                      {/* View Details */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails(result)
                        }}
                        className={cn(
                          "h-8 w-8 p-0 text-muted hover:text-fg border border-border/40 hover:border-border",
                          "hover:bg-elev-1 transition-all duration-120"
                        )}
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      {/* Add to Portfolio */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToPortfolio(result)
                        }}
                        className={cn(
                          "h-8 px-3 bg-accent text-black border border-accent hover:bg-accent/90",
                          "hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-120 font-medium"
                        )}
                        title="Add to Portfolio"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Non-virtualized results (<=25 items) */}
              {!useVirtualization && results.map((result, index) => {
                const isSelected = index === selectedIndex
                const deltaPositive = (result.delta7dPct ?? 0) > 0

                return (
                  <div
                    key={result.sku}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex items-center gap-4 p-4 transition-all duration-120 cursor-pointer",
                      "border-b border-border/10 last:border-0",
                      isSelected
                        ? "bg-elev-2 shadow-[inset_3px_0_0_0_rgba(0,255,148,0.7)]"
                        : "hover:bg-elev-2/50"
                    )}
                    style={{ minHeight: '88px' }}
                  >
                    {/* Thumbnail */}
                    {result.imageUrl && (
                      <img
                        src={result.imageUrl}
                        alt={result.name}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border/20"
                      />
                    )}

                    {/* Title & Subtitle */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-fg text-base truncate leading-snug">
                        {result.name}
                      </p>
                      <p className="text-sm text-muted truncate mt-0.5">{result.subtitle}</p>
                    </div>

                    {/* Price Block */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Median Price */}
                      {result.median !== null && (
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold text-fg tabular-nums">
                            {format(result.median)}
                          </p>
                        </div>
                      )}

                      {/* Sparkline + Delta */}
                      {(() => {
                        const hasData = result.series7d.some(v => v !== null)

                        if (!hasData) {
                          return (
                            <div className="text-xs text-muted">No recent data</div>
                          )
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <Sparkline
                              data={result.series7d.filter((v): v is number => v !== null)}
                              width={60}
                              height={20}
                              color={deltaPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                            />
                            {result.delta7dPct !== null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-mono tabular-nums px-1.5 py-0.5 h-5",
                                  deltaPositive
                                    ? "text-success border-success/40 bg-success/10"
                                    : "text-danger border-danger/40 bg-danger/10"
                                )}
                              >
                                {deltaPositive ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                                {deltaPositive ? '+' : ''}{result.delta7dPct.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted font-mono">—</span>
                            )}
                          </div>
                        )
                      })()}

                      {!result.median && (
                        <span className="text-sm text-muted font-mono">—</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Add to Watchlist */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToWatchlist(result)
                        }}
                        className={cn(
                          "h-8 w-8 p-0 text-muted hover:text-fg border border-border/40 hover:border-border",
                          "hover:bg-elev-1 transition-all duration-120"
                        )}
                        title="Add to Watchlist"
                      >
                        <Heart className="h-3.5 w-3.5" />
                      </Button>

                      {/* View Details */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails(result)
                        }}
                        className={cn(
                          "h-8 w-8 p-0 text-muted hover:text-fg border border-border/40 hover:border-border",
                          "hover:bg-elev-1 transition-all duration-120"
                        )}
                        title="View Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      {/* Add to Portfolio */}
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddToPortfolio(result)
                        }}
                        className={cn(
                          "h-8 px-3 bg-accent text-black border border-accent hover:bg-accent/90",
                          "hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-120 font-medium"
                        )}
                        title="Add to Portfolio"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer Hint */}
            {filteredResults.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border/20 bg-elev-2/50 text-xs text-muted">
                <span>Use ↑↓ to navigate</span>
                <div className="flex items-center gap-4">
                  {/* Dev-only: API metadata */}
                  {process.env.NODE_ENV === 'development' && apiMeta && (
                    <span className="font-mono text-[10px] opacity-60">
                      {apiMeta.duration_ms !== undefined && `${apiMeta.duration_ms}ms`}
                      {apiMeta.cache && ` • cache:${apiMeta.cache}`}
                    </span>
                  )}
                  <span>Enter to add • Esc to close</span>
                </div>
              </div>
            )}
          </div>

          {/* Optional Right-Side Preview (≥1280px) */}
          {selectedResult && (
            <div className="hidden xl:block w-80 border-l border-border/20 bg-elev-2/30 p-6">
              <div className="space-y-6">
                {/* Large Image */}
                {selectedResult.imageUrl && (
                  <div className="w-full aspect-square rounded-xl overflow-hidden border border-border/20 bg-elev-1">
                    <img
                      src={selectedResult.imageUrl}
                      alt={selectedResult.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Title */}
                <div>
                  <h3 className="font-cinzel font-bold text-lg text-fg leading-tight">
                    {selectedResult.name}
                  </h3>
                  <p className="text-sm text-muted mt-1">{selectedResult.subtitle}</p>
                  <Badge variant="outline" className="font-mono text-xs mt-2">
                    {selectedResult.sku}
                  </Badge>
                </div>

                {/* Market Summary */}
                {selectedResult.median !== null && (
                  <div className="p-4 bg-elev-1 border border-border/40 rounded-xl">
                    <p className="text-xs text-accent uppercase tracking-wider font-cinzel mb-3">
                      Market Summary
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted uppercase tracking-wider">Median</span>
                        <span className="text-xl font-mono font-bold text-fg tabular-nums">
                          {format(selectedResult.median)}
                        </span>
                      </div>
                      {/* TODO(server): Add min/max prices */}
                    </div>

                    {/* 7-day Trend */}
                    {selectedResult.series7d.length > 0 && selectedResult.delta7dPct !== null && (
                      <div className="mt-4 pt-4 border-t border-border/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted">7-day trend</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-mono tabular-nums",
                              (selectedResult.delta7dPct ?? 0) > 0
                                ? "text-success border-success/40 bg-success/10"
                                : "text-danger border-danger/40 bg-danger/10"
                            )}
                          >
                            {(selectedResult.delta7dPct ?? 0) > 0 ? '+' : ''}{selectedResult.delta7dPct.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sources */}
                <div className="p-4 bg-elev-1 border border-border/40 rounded-xl">
                  <p className="text-xs text-accent uppercase tracking-wider font-cinzel mb-3">
                    Data Sources (Last 7 Days)
                  </p>
                  {selectedResult.sources && selectedResult.sources.length > 0 ? (
                    <div className="space-y-2">
                      {selectedResult.sources.map(source => (
                        <div key={source.name} className="flex items-center justify-between">
                          <span className="text-sm text-muted capitalize">{source.name}</span>
                          <span className="text-sm font-mono font-semibold text-fg">
                            {source.count} {source.count === 1 ? 'listing' : 'listings'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">No sources available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Add to Watchlist Modal */}
      <AddToWatchlistModal
        open={watchlistModalOpen}
        onOpenChange={setWatchlistModalOpen}
        product={selectedWatchlistProduct}
        onSuccess={handleWatchlistSuccess}
      />
    </Dialog>
  )
}
