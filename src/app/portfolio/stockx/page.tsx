'use client'

import { useState } from 'react'
import { useStockxListings, useListingOperations } from '@/hooks/useStockxListings'
import { ListingStatusBadge } from '@/components/stockx/ListingStatusBadge'
import { RepriceListingModal } from '@/components/stockx/RepriceListingModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}
import { MoreHorizontal, ArrowUpCircle, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function StockXListingsPage() {
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const { listings, loading, refetch } = useStockxListings({
    status: statusFilter.length > 0 ? statusFilter : undefined,
    search: searchTerm,
  })
  const { deactivateListing, activateListing, deleteListing } = useListingOperations()

  const [repriceModal, setRepriceModal] = useState<{ open: boolean; listing: any; invested: number }>({
    open: false,
    listing: null,
    invested: 0,
  })

  const handleAction = async (action: 'deactivate' | 'activate' | 'delete', listingId: string) => {
    try {
      if (action === 'deactivate') await deactivateListing(listingId)
      if (action === 'activate') await activateListing(listingId)
      if (action === 'delete') {
        if (confirm('Are you sure you want to delete this listing?')) {
          await deleteListing(listingId)
        } else {
          return
        }
      }
      refetch()
    } catch (err) {
      console.error('Action failed:', err)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">StockX Listings</h1>
          <p className="text-sm text-muted-foreground">Manage your active StockX listings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Search by SKU, product name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={statusFilter[0] || 'all'}
          onValueChange={(value) => setStatusFilter(value === 'all' ? [] : [value])}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="MATCHED">Matched</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Size</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Ask</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Market</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Delta</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Expires</th>
                <th className="px-4 py-3 text-right text-sm font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading listings...
                  </td>
                </tr>
              )}
              {!loading && listings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No listings found
                  </td>
                </tr>
              )}
              {!loading && listings.map((listing) => {
                const delta = listing.market_price ? listing.ask_price - listing.market_price : null
                const deltaPercent = listing.market_price ? ((delta! / listing.market_price) * 100) : null

                return (
                  <tr key={listing.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {listing.image_url && (
                          <img
                            src={listing.image_url}
                            alt={listing.product_name || listing.sku || ''}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-sm">{listing.product_name || listing.sku}</p>
                          <p className="text-xs text-muted-foreground">{listing.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">UK{listing.size_uk}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {formatCurrency(listing.ask_price, listing.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                      {listing.market_price ? formatCurrency(listing.market_price, listing.currency) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {delta !== null && deltaPercent !== null ? (
                        <span className={delta > 0 ? 'text-green-600' : 'text-red-600'}>
                          {delta > 0 ? '+' : ''}{formatCurrency(delta, listing.currency)} ({deltaPercent.toFixed(1)}%)
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ListingStatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {listing.expires_at
                        ? new Date(listing.expires_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {listing.status === 'ACTIVE' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => setRepriceModal({
                                  open: true,
                                  listing,
                                  invested: 0, // TODO: fetch from inventory
                                })}
                              >
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Reprice
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction('deactivate', listing.stockx_listing_id)}
                              >
                                <PauseCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            </>
                          )}
                          {listing.status === 'INACTIVE' && (
                            <DropdownMenuItem
                              onClick={() => handleAction('activate', listing.stockx_listing_id)}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          {(listing.status === 'INACTIVE' || listing.status === 'EXPIRED') && (
                            <DropdownMenuItem
                              onClick={() => handleAction('delete', listing.stockx_listing_id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reprice Modal */}
      {repriceModal.open && repriceModal.listing && (
        <RepriceListingModal
          open={repriceModal.open}
          onClose={() => setRepriceModal({ open: false, listing: null, invested: 0 })}
          onSuccess={() => refetch()}
          listing={repriceModal.listing}
          invested={repriceModal.invested}
        />
      )}
    </div>
  )
}
