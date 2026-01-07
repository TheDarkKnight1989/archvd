'use client'

/**
 * AliasLinkModal
 *
 * Modal for manually attaching an Alias (GOAT) product to an inventory item.
 * Once linked, Alias-first image logic will automatically pull images everywhere.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { EnrichedLineItem } from '@/lib/portfolio/types'

interface AliasLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: EnrichedLineItem | null
  onLinked?: () => void
}

interface AliasSearchResult {
  catalog_id: string
  name: string
  brand: string
  sku: string
  colorway?: string
  main_picture_url?: string
  product_category_v2?: string
  release_date?: string
  retail_price_cents?: number
}

export function AliasLinkModal({
  open,
  onOpenChange,
  item,
  onLinked,
}: AliasLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<AliasSearchResult[]>([])
  const [attaching, setAttaching] = useState<string | null>(null) // catalog_id being attached
  const [error, setError] = useState<string | null>(null)

  // Pre-fill search with SKU when modal opens
  useEffect(() => {
    if (open && item) {
      const initialQuery = item.sku || `${item.brand} ${item.model}`.trim()
      setSearchQuery(initialQuery)
    } else {
      // Reset state when modal closes
      setSearchQuery('')
      setSearchResults([])
      setError(null)
      setAttaching(null)
    }
  }, [open, item])

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const searchProducts = async () => {
      setIsSearching(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/alias/search?query=${encodeURIComponent(searchQuery)}&limit=10`
        )

        if (!response.ok) {
          throw new Error('Search failed')
        }

        const data = await response.json()

        if (data.success && data.items) {
          setSearchResults(data.items)
        } else {
          setSearchResults([])
        }
      } catch (err) {
        console.error('[AliasLinkModal] Search error:', err)
        setError('Failed to search Alias products')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  // Attach product handler
  const handleAttach = async (product: AliasSearchResult) => {
    if (!item) return

    setAttaching(product.catalog_id)
    setError(null)

    try {
      const response = await fetch('/api/alias/inventory/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventoryId: item.id,
          aliasCatalogId: product.catalog_id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to attach Alias product')
      }

      // Success!
      console.log('[AliasLinkModal] Successfully attached product:', product.catalog_id)

      // Notify parent to refetch inventory
      onLinked?.()

      // Show success (could use toast here)
      setError(null)

      // Close modal
      onOpenChange(false)

    } catch (err: any) {
      console.error('[AliasLinkModal] Attach error:', err)
      setError(err.message || 'Failed to attach Alias product')
    } finally {
      setAttaching(null)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-none sm:max-w-2xl lg:max-w-3xl sm:w-[90vw] max-h-[calc(100vh-40px)] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border-0 bg-[#111111]/95 backdrop-blur-md p-0 overflow-hidden shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 rounded-lg p-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="border-b border-[#2a2a2a] px-4 sm:px-8 py-4 sm:py-6 pr-12">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white mb-2">
              Attach Alias Product
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              Link this inventory item to an Alias / GOAT product so images and data can stay in sync.
            </DialogDescription>
          </DialogHeader>

          {/* Current Item Info */}
          <div className="mt-4 bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
            <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Current Item
            </div>
            <div className="font-semibold text-white text-base">
              {item.brand} {item.model}
            </div>
            <div className="text-sm text-gray-400 font-mono mt-1">SKU: {item.sku}</div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-280px)]">
          {/* Search Input */}
          <div>
            <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
              Search Alias Catalog
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by SKU or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-[#00FF94] focus:ring-[#00FF94]"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Search Results */}
          <div className="space-y-3">
            {searchResults.length === 0 && !isSearching && searchQuery.trim().length >= 2 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-base">No Alias products found for this query.</p>
                <p className="text-sm mt-2 text-gray-500">Try another SKU or product name.</p>
              </div>
            )}

            {searchResults.map((product) => (
              <div
                key={product.catalog_id}
                className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a] hover:border-[#00FF94]/40 transition-all"
              >
                <div className="flex gap-4 items-center">
                  {/* Product Image */}
                  {product.main_picture_url && (
                    <img
                      src={product.main_picture_url}
                      alt={product.name}
                      className="w-24 h-24 rounded-lg object-cover bg-[#0a0a0a] flex-shrink-0 border border-[#2a2a2a]"
                    />
                  )}

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-base mb-2">{product.name}</div>
                    <div className="text-sm text-gray-400 mb-1">
                      {product.brand} • {product.sku}
                    </div>
                    {product.colorway && (
                      <div className="text-sm text-gray-500">{product.colorway}</div>
                    )}
                  </div>

                  {/* Attach Button - Much more prominent */}
                  <div className="flex-shrink-0">
                    <Button
                      onClick={() => handleAttach(product)}
                      disabled={attaching === product.catalog_id}
                      className="bg-[#00FF94] hover:bg-[#00E085] text-black font-bold px-8 py-6 text-base rounded-lg shadow-lg hover:shadow-[#00FF94]/20 transition-all disabled:opacity-50"
                    >
                      {attaching === product.catalog_id ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Attaching...
                        </>
                      ) : (
                        'Attach'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
