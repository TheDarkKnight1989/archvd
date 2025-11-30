'use client'

/**
 * Active Listings Section
 *
 * Displays active StockX listings with columns:
 * - Product (image + name)
 * - Size
 * - Ask price
 * - Market price (bid/ask)
 * - Position (vs lowest ask)
 * - Age ("Listed 5d ago")
 * - Actions (dropdown menu)
 */

import { useState } from 'react'
import type { StockxListing } from '@/hooks/useStockxListings'
import { useListingOperations } from '@/hooks/useStockxListings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, MoreVertical, Edit, TrendingDown, Pause, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const { deactivateListing } = useListingOperations()

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

    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Format currency
  const formatPrice = (amount: number | undefined, currency: string = 'GBP'): string => {
    if (!amount || amount === 0) return '—'
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

  const handlePause = async (listing: StockxListing) => {
    if (!confirm('Pause this listing? You can reactivate it later.')) return

    const loadingToast = toast.loading('Pausing listing...')

    try {
      await deactivateListing(listing.stockx_listing_id)
      toast.dismiss(loadingToast)
      toast.success('Listing paused successfully')
      await onRefresh()
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error(error.message || 'Failed to pause listing')
      console.error('Failed to pause listing:', error)
    }
  }

  const handleCancel = async (listing: StockxListing) => {
    if (!confirm('Are you sure you want to cancel this listing?')) return

    const loadingToast = toast.loading('Canceling listing...')

    try {
      await fetch('/api/stockx/listings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.stockx_listing_id }),
      })
      toast.dismiss(loadingToast)
      toast.success('Listing canceled successfully')
      await onRefresh()
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error(error.message || 'Failed to cancel listing')
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
      {/* Search Bar - Match Inventory styling */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product, SKU, or size..."
            className={cn(
              'pl-9 bg-elev-0 border-border transition-all duration-120 text-fg',
              searchQuery && 'ring-2 ring-[#00FF94]/35 border-[#00FF94]/35'
            )}
          />
        </div>
        <div className="text-sm text-fg/70">
          {filteredListings.length} of {listings.length} listings
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border-2 border-border/40 bg-elev-1 overflow-hidden shadow-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-elev-0/50">
              <TableHead className="w-[350px] font-semibold text-fg/80">Product</TableHead>
              <TableHead className="w-[100px] font-semibold text-fg/80">Size</TableHead>
              <TableHead className="w-[120px] font-semibold text-fg/80">Ask Price</TableHead>
              <TableHead className="w-[160px] font-semibold text-fg/80">Market</TableHead>
              <TableHead className="w-[110px] font-semibold text-fg/80">Position</TableHead>
              <TableHead className="w-[100px] font-semibold text-fg/80">Age</TableHead>
              <TableHead className="w-[60px] text-right font-semibold text-fg/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted/70">
                  {searchQuery ? 'No listings match your search' : 'No active listings'}
                </TableCell>
              </TableRow>
            ) : (
              filteredListings.map((listing) => (
                <TableRow key={listing.id} className="border-b border-border hover:bg-elev-0/50 transition-all duration-120">
                  {/* Product */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 rounded-lg border-2 border-border/40 bg-elev-0 overflow-hidden flex-shrink-0 shadow-sm">
                        {listing.image_url ? (
                          <Image
                            src={listing.image_url}
                            alt={listing.product_name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted/50">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-fg truncate">
                          {listing.product_name || 'Unknown Product'}
                        </div>
                        <div className="text-xs text-muted/70 mono truncate">
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

                  {/* Ask Price - Show "—" if £0 or missing */}
                  <TableCell>
                    <span className={cn(
                      "text-sm mono font-medium",
                      listing.ask_price && listing.ask_price > 0 ? "text-fg" : "text-muted"
                    )}>
                      {formatPrice(listing.ask_price, listing.currency_code)}
                    </span>
                  </TableCell>

                  {/* Market Price */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {listing.market_lowest_ask && listing.market_lowest_ask > 0 ? (
                        <div className="text-xs text-muted">
                          Ask: <span className="mono font-medium text-fg">{formatPrice(listing.market_lowest_ask, listing.currency_code)}</span>
                        </div>
                      ) : null}
                      {listing.market_highest_bid && listing.market_highest_bid > 0 ? (
                        <div className="text-xs text-muted">
                          Bid: <span className="mono font-medium text-fg">{formatPrice(listing.market_highest_bid, listing.currency_code)}</span>
                        </div>
                      ) : null}
                      {(!listing.market_lowest_ask || listing.market_lowest_ask === 0) &&
                       (!listing.market_highest_bid || listing.market_highest_bid === 0) && (
                        <div className="text-xs text-muted">—</div>
                      )}
                    </div>
                  </TableCell>

                  {/* Position - Use computed position from hook */}
                  <TableCell>
                    {listing.position ? (
                      <span className={cn(
                        "text-sm mono font-medium",
                        listing.position === 'Best ask' && "text-[#00FF94]",
                        listing.position.startsWith('+') && "text-orange-400",
                        listing.position.startsWith('-') && "text-blue-400"
                      )}>
                        {listing.position}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </TableCell>

                  {/* Age */}
                  <TableCell>
                    <span className="text-sm text-muted">
                      {formatTimeAgo(listing.created_at)}
                    </span>
                  </TableCell>

                  {/* Actions - Dropdown Menu */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-elev-0 transition-all duration-120"
                        >
                          <MoreVertical className="h-4 w-4 text-fg/60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 bg-elev-1 border-2 border-border/40 shadow-lg">
                        <DropdownMenuItem
                          onClick={() => handleEdit(listing)}
                          className="text-fg hover:bg-elev-0 cursor-pointer transition-colors"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleLowerPrice(listing)}
                          className="text-orange-400 hover:bg-elev-0 cursor-pointer transition-colors"
                        >
                          <TrendingDown className="mr-2 h-4 w-4" />
                          Lower Price
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePause(listing)}
                          className="text-yellow-400 hover:bg-elev-0 cursor-pointer transition-colors"
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleCancel(listing)}
                          className="text-red-400 hover:bg-elev-0 focus:text-red-400 cursor-pointer transition-colors"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
