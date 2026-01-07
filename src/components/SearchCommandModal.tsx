'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Search, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { generateProductSlug } from '@/lib/utils/slug'
import { useUnifiedSearchV4 } from '@/hooks/useUnifiedSearchV4'

interface SearchCommandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommandModal({ open, onOpenChange }: SearchCommandModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { search, results, isSearching, clear } = useUnifiedSearchV4({
    debounceMs: 250,
    limit: 8,
    includeExternal: true,
    minQueryLength: 2,
  })

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is mounted
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    } else {
      // Clear search when modal closes
      clear()
    }
  }, [open, clear])

  const handleSelect = useCallback((result: typeof results[0]) => {
    const slug = generateProductSlug(result.name, result.styleId)
    onOpenChange(false)

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
  }, [router, onOpenChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false)
    }
    // Could add arrow key navigation here later
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-full max-w-2xl p-0 gap-0 overflow-hidden",
          "bg-[#111111]/95 backdrop-blur-xl border border-white/10",
          "rounded-xl shadow-2xl"
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-accent animate-spin flex-shrink-0" />
          ) : (
            <Search className="h-5 w-5 text-muted flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products by name, SKU, or paste a URL..."
            className={cn(
              "flex-1 bg-transparent text-fg text-base",
              "placeholder:text-muted/60",
              "outline-none border-none"
            )}
            onChange={(e) => {
              search(e.target.value).catch(() => {
                // Silently handle search errors - UI already shows error state
              })
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-border/60 bg-elev-2 px-2 font-mono text-[10px] font-medium text-muted/70">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length === 0 && !isSearching ? (
            <div className="px-4 py-8 text-center text-muted text-sm">
              Type to search products...
            </div>
          ) : results.length === 0 && isSearching ? (
            <div className="px-4 py-8 text-center text-muted text-sm">
              Searching...
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
                      className="w-14 h-14 object-cover rounded-lg bg-elev-2 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-elev-2 rounded-lg flex items-center justify-center flex-shrink-0">
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
                    {result.colorway && (
                      <div className="text-xs text-muted/60 truncate mt-0.5">
                        {result.colorway}
                      </div>
                    )}
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

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 text-xs text-muted/50">
            Click to view market data
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
