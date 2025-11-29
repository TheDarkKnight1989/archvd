'use client'

/**
 * History Section
 *
 * Displays past listings (sold, expired, cancelled) with net payout
 */

import type { StockxListing } from '@/hooks/useStockxListings'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Image from 'next/image'

export interface HistorySectionProps {
  listings: StockxListing[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export function HistorySection({ listings, loading, onRefresh }: HistorySectionProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter listings
  const filteredListings = listings.filter(listing => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      listing.product_name?.toLowerCase().includes(query) ||
      listing.sku?.toLowerCase().includes(query) ||
      listing.size_uk?.toLowerCase().includes(query)
    )
  })

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
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

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SOLD':
        return (
          <Badge className="bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            Sold
          </Badge>
        )
      case 'EXPIRED':
        return (
          <Badge className="bg-muted/10 text-muted border-muted/30 gap-1">
            <Clock className="h-3 w-3" />
            Expired
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        )
      default:
        return null
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
            placeholder="Search history..."
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted">
          {filteredListings.length} of {listings.length} historical listings
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
              <TableHead className="w-[120px]">Net Payout</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[140px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredListings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted">
                  {searchQuery ? 'No listings match your search' : 'No historical listings'}
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

                  {/* Net Payout */}
                  <TableCell>
                    <span className="text-sm text-muted mono">
                      {listing.status === 'SOLD' ? formatPrice(listing.ask_price * 0.88, listing.currency) : '-'}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {getStatusBadge(listing.status)}
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <span className="text-sm text-muted">
                      {formatDate(listing.updated_at)}
                    </span>
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
