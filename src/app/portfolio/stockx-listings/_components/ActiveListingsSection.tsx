'use client'

/**
 * Active Listings Section
 *
 * Displays active StockX listings with columns:
 * - Product (image + name)
 * - Size
 * - Ask price
 * - Market price (bid/ask)
 * - Position (e.g., "#3 of 14")
 * - Age ("Listed 5d ago")
 * - Actions (Edit, Lower price, Cancel listing)
 */

import { useState } from 'react'
import type { StockxListing } from '@/hooks/useStockxListings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Edit, TrendingDown, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Image from 'next/image'

export interface ActiveListingsSectionProps {
  listings: StockxListing[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export function ActiveListingsSection({
  listings,
  loading,
  onRefresh,
}: ActiveListingsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter listings based on search
  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      listing.product_name?.toLowerCase().includes(query) ||
      listing.sku?.toLowerCase().includes(query) ||
      listing.size_uk?.toLowerCase().includes(query)
    )
  })

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 60) return `Listed ${diffMinutes}m ago`
    if (diffHours < 24) return `Listed ${diffHours}h ago`
    return `Listed ${diffDays}d ago`
  }

  // Format currency
  const formatPrice = (amount: number, currency: string = 'GBP'): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Handle actions
  const handleEdit = (listing: StockxListing) => {
    console.log('Edit listing:', listing.id)
    // TODO: Open edit modal
  }

  const handleLowerPrice = (listing: StockxListing) => {
    console.log('Lower price:', listing.id)
    // TODO: Open lower price modal
  }

  const handleCancel = async (listing: StockxListing) => {
    if (!confirm('Are you sure you want to cancel this listing?')) return

    try {
      await fetch('/api/stockx/listings/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.stockx_listing_id }),
      })
      await onRefresh()
    } catch (error) {
      console.error('Failed to cancel listing:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product, SKU, or size..."
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted">
          {filteredListings.length} of {listings.length} listings
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-soft/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[350px]">Product</TableHead>
              <TableHead className="w-[100px]">Size</TableHead>
              <TableHead className="w-[120px]">Ask Price</TableHead>
              <TableHead className="w-[180px]">Market Price</TableHead>
              <TableHead className="w-[120px]">Position</TableHead>
              <TableHead className="w-[140px]">Age</TableHead>
              <TableHead className="w-[240px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted">
                  {searchQuery ? 'No listings match your search' : 'No active listings'}
                </TableCell>
              </TableRow>
            ) : (
              filteredListings.map((listing) => (
                <TableRow key={listing.id} className="border-border hover:bg-soft/40">
                  {/* Product */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 rounded border border-border bg-soft overflow-hidden flex-shrink-0">
                        {listing.image_url ? (
                          <Image
                            src={listing.image_url}
                            alt={listing.product_name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-fg truncate">
                          {listing.product_name || 'Unknown Product'}
                        </div>
                        <div className="text-xs text-muted mono truncate">
                          {listing.sku || listing.stockx_product_id}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Size */}
                  <TableCell>
                    <span className="text-sm text-fg mono">
                      UK {listing.size_uk || 'N/A'}
                    </span>
                  </TableCell>

                  {/* Ask Price */}
                  <TableCell>
                    <span className="text-sm font-medium text-fg mono">
                      {formatPrice(listing.ask_price, listing.currency)}
                    </span>
                  </TableCell>

                  {/* Market Price */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {listing.market_lowest_ask && (
                        <div className="text-xs text-muted">
                          Ask: <span className="mono">{formatPrice(listing.market_lowest_ask, listing.currency)}</span>
                        </div>
                      )}
                      {listing.market_highest_bid && (
                        <div className="text-xs text-muted">
                          Bid: <span className="mono">{formatPrice(listing.market_highest_bid, listing.currency)}</span>
                        </div>
                      )}
                      {!listing.market_lowest_ask && !listing.market_highest_bid && (
                        <div className="text-xs text-muted">No data</div>
                      )}
                    </div>
                  </TableCell>

                  {/* Position */}
                  <TableCell>
                    <span className="text-sm text-muted mono">
                      {listing.status === 'PENDING' ? 'Pending' : '-'}
                    </span>
                  </TableCell>

                  {/* Age */}
                  <TableCell>
                    <span className="text-sm text-muted">
                      {formatTimeAgo(listing.created_at)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => handleEdit(listing)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleLowerPrice(listing)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-[#FFA500]"
                      >
                        <TrendingDown className="h-3.5 w-3.5" />
                        Lower
                      </Button>
                      <Button
                        onClick={() => handleCancel(listing)}
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-red-400"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
