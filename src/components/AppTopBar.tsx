'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Camera, Search, Bell, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { AppLogoButton } from './AppLogoButton'
import { UserProfileMenu } from './UserProfileMenu'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import { SearchCommandModal } from './SearchCommandModal'
import { cn } from '@/lib/utils/cn'
import { generateProductSlug } from '@/lib/utils/slug'
import { useUnifiedSearchV4 } from '@/hooks/useUnifiedSearchV4'

interface AppTopBarProps {
  onMenuClick?: () => void
}

export function AppTopBar({ onMenuClick }: AppTopBarProps) {
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const { search, results, isSearching, clear } = useUnifiedSearchV4({
    debounceMs: 250,
    limit: 8,
    includeExternal: true,
    minQueryLength: 2,
  })

  // ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // ESC to blur and close dropdown
      if (e.key === 'Escape' && searchFocused) {
        searchInputRef.current?.blur()
        setSearchFocused(false)
        clear()
        setSearchValue('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchFocused, clear])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
        clear()
        setSearchValue('')
      }
    }
    if (searchFocused) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchFocused, clear])

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value)
    search(value).catch(() => {
      // Silently handle - UI shows error state
    })
  }, [search])

  const handleSelect = useCallback((result: typeof results[0]) => {
    const slug = generateProductSlug(result.name, result.styleId)
    setSearchFocused(false)
    clear()
    setSearchValue('')

    // Build URL with external IDs for products not in our database
    // This allows market-v4 to create the style entry on demand
    const params = new URLSearchParams()
    if (!result.inDatabase) {
      if (result.externalIds?.aliasCatalogId) {
        params.set('aliasId', result.externalIds.aliasCatalogId)
      }
      if (result.externalIds?.stockxProductId) {
        params.set('stockxId', result.externalIds.stockxProductId)
      }
      if (result.externalIds?.stockxUrlKey) {
        params.set('stockxUrlKey', result.externalIds.stockxUrlKey)
      }
      if (result.name) {
        params.set('name', encodeURIComponent(result.name))
      }
      if (result.brand) {
        params.set('brand', encodeURIComponent(result.brand))
      }
      if (result.colorway) {
        params.set('colorway', encodeURIComponent(result.colorway))
      }
      if (result.imageUrl) {
        params.set('imageUrl', encodeURIComponent(result.imageUrl))
      }
    }

    const queryString = params.toString()
    const url = `/portfolio/market-v4/${slug}${queryString ? `?${queryString}` : ''}`
    router.push(url)
  }, [router, clear])

  const handleMobileSearchClick = () => {
    setMobileSearchOpen(true)
  }

  const handleCalculatorClick = () => {
    // TODO: Wire up profit calculator
    console.log('TODO: open profit calculator')
  }

  const handleCameraClick = () => {
    setScannerOpen(true)
  }

  const handleNotificationsClick = () => {
    // TODO: Wire up notifications system
    console.log('TODO: open notifications')
  }

  const handleBarcodeDetected = async (gtin: string) => {
    try {
      setScannerOpen(false) // Close modal immediately

      const loadingToast = toast.loading('Finding market data...')

      const res = await fetch(`/api/stockx/lookup/gtin?gtin=${encodeURIComponent(gtin)}`)

      if (!res.ok) {
        throw new Error('Lookup failed')
      }

      const data = await res.json()

      // Get SKU from response (respecting existing API shape)
      const sku = data.product?.sku
      const productName = data.product?.name || data.product?.brand || 'Product'

      if (!sku) {
        throw new Error('No SKU in GTIN response')
      }

      // Use the same slug generation logic as inventory "View Market" action
      const slug = generateProductSlug(productName, sku)

      console.log('[Barcode] Navigating to market:', { gtin, sku, slug })

      toast.dismiss(loadingToast)
      toast.success('Product found!')

      // Navigate to market page
      router.push(`/portfolio/market/${slug}`)
    } catch (err) {
      console.error('[Barcode Lookup] Failed', err)
      toast.error("Couldn't find this product on StockX")
    }
  }

  return (
    <>
      {/* Mobile: Single-row header with logo, search, and utility icons */}
      <div
        className="block md:hidden sticky top-0 z-30 border-b border-border/50"
        style={{
          background: 'linear-gradient(135deg, #0E1A15 0%, #0B1510 50%, rgba(0, 255, 148, 0.03) 100%)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* Logo Button */}
            <AppLogoButton onClick={onMenuClick} />

            {/* Search Bar (Mobile - opens modal) */}
            <button
              onClick={handleMobileSearchClick}
              className={cn(
                "flex-1 h-10 rounded-lg px-3",
                "bg-elev-1/50 border border-border/30",
                "flex items-center gap-2",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            >
              <Search className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
              <span className="text-sm">Search products...</span>
            </button>

            {/* Utility Icons */}
            <button
              onClick={handleCalculatorClick}
              aria-label="Open profit calculator"
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                "bg-elev-1/50 border border-border/30",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                "active:scale-95"
              )}
            >
              <Calculator className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <button
              onClick={handleCameraClick}
              aria-label="Open barcode scanner"
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                "bg-elev-1/50 border border-border/30",
                "text-muted hover:text-fg hover:bg-elev-2/80",
                "transition-all duration-200",
                "hover:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                "active:scale-95"
              )}
            >
              <Camera className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop: Large search-focused header */}
      <div className="hidden md:block sticky top-0 z-30 bg-elev-1/95 border-b border-white/5 backdrop-blur-sm">
        <div className="h-16 flex items-center justify-between gap-4 px-6">
          {/* Left Side: Search Bar + Utility Icons */}
          <div className="flex-1 flex items-center gap-2 mr-4">
            {/* Inline Search Bar with Dropdown */}
            <div ref={searchContainerRef} className="relative w-full max-w-4xl">
              <div
                className={cn(
                  "w-full h-11 rounded-lg px-4",
                  "bg-elev-1/50 border",
                  "flex items-center gap-3",
                  "transition-all duration-200 shadow-sm",
                  searchFocused
                    ? "border-accent/50 bg-elev-2/80 ring-2 ring-accent/20"
                    : "border-white/10 hover:border-accent/30 hover:bg-elev-2/80"
                )}
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 text-accent animate-spin" strokeWidth={2} />
                ) : (
                  <Search className="h-5 w-5 flex-shrink-0 text-muted/70" strokeWidth={2} />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Search products..."
                  className={cn(
                    "flex-1 bg-transparent text-fg text-sm",
                    "placeholder:text-muted/60",
                    "outline-none border-none"
                  )}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-elev-2 px-2 font-mono text-[10px] font-medium text-muted/70">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>

              {/* Search Results Dropdown */}
              {searchFocused && (searchValue.length >= 2 || results.length > 0) && (
                <div className={cn(
                  "absolute top-full left-0 right-0 mt-2 z-50",
                  "bg-[#111111]/98 backdrop-blur-xl border border-white/10",
                  "rounded-xl shadow-2xl overflow-hidden",
                  "animate-in fade-in-0 zoom-in-95 duration-150"
                )}>
                  <div className="max-h-[400px] overflow-y-auto">
                    {results.length === 0 && !isSearching && searchValue.length >= 2 ? (
                      <div className="px-4 py-6 text-center text-muted text-sm">
                        No results found
                      </div>
                    ) : results.length === 0 && isSearching ? (
                      <div className="px-4 py-6 text-center text-muted text-sm">
                        Searching...
                      </div>
                    ) : results.length === 0 ? (
                      <div className="px-4 py-6 text-center text-muted text-sm">
                        Type to search products...
                      </div>
                    ) : (
                      <div className="py-2">
                        {results.map((result, index) => (
                          <button
                            key={`${result.source}-${result.styleId}-${index}`}
                            onClick={() => handleSelect(result)}
                            className={cn(
                              "w-full px-4 py-3 flex items-center gap-4",
                              "hover:bg-white/5 transition-colors",
                              "text-left group"
                            )}
                          >
                            {/* Image */}
                            {result.imageUrl ? (
                              <img
                                src={result.imageUrl}
                                alt={result.name}
                                className="w-12 h-12 object-cover rounded-lg bg-elev-2 flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-elev-2 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-muted/40 text-xs">No img</span>
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted/60 mb-0.5 truncate">
                                {result.styleId}
                              </div>
                              <div className="font-medium text-fg truncate">
                                {result.brand}
                              </div>
                              <div className="text-sm text-muted truncate">
                                {result.name}
                              </div>
                            </div>

                            {/* Source badge + arrow */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase",
                                result.source === 'local' && "bg-accent/20 text-accent",
                                result.source === 'stockx' && "bg-emerald-500/20 text-emerald-400",
                                result.source === 'alias' && "bg-blue-500/20 text-blue-400"
                              )}>
                                {result.source === 'local' ? 'DB' : result.source}
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted/40 group-hover:text-accent transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {results.length > 0 && (
                    <div className="px-4 py-2 border-t border-white/5 text-xs text-muted/50">
                      Click to view market data
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Calculator Icon */}
            <button
              onClick={handleCalculatorClick}
              aria-label="Open profit calculator"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "bg-elev-1/50 border border-white/10 text-muted",
                "hover:border-accent/30 hover:bg-elev-2/80 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Calculator className="h-5 w-5" strokeWidth={2} />
            </button>

            {/* Camera Icon */}
            <button
              onClick={handleCameraClick}
              aria-label="Open barcode scanner"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "bg-elev-1/50 border border-white/10 text-muted",
                "hover:border-accent/30 hover:bg-elev-2/80 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Camera className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          {/* Right Side: Notifications + Profile */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              onClick={handleNotificationsClick}
              aria-label="Notifications"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "bg-elev-1/50 border border-white/10 text-muted",
                "hover:border-accent/30 hover:bg-elev-2/80 hover:text-fg",
                "transition-all duration-200",
                "active:scale-95"
              )}
            >
              <Bell className="h-5 w-5" strokeWidth={2} />
            </button>

            {/* User Profile */}
            <UserProfileMenu />
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onBarcodeDetected={handleBarcodeDetected}
      />

      {/* Search Command Modal (Mobile only) */}
      <SearchCommandModal
        open={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />
    </>
  )
}
