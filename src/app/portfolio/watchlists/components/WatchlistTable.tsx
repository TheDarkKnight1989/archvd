'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Loader2,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Trash2,
  Plus,
  Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCurrency } from '@/hooks/useCurrency'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { AddToWatchlistDialog } from './AddToWatchlistDialog'

type WatchlistItem = {
  id: string
  sku: string
  size: string | null
  target_price: number | null
  created_at: string
  product_catalog: {
    brand: string
    model: string
    colorway: string | null
    image_url: string | null
    retail_price: number | null
    retail_currency: string | null
  } | null
  latest_price: number | null
  latest_currency: string | null
  latest_source: string | null
  latest_as_of: string | null
  alert: boolean
}

interface WatchlistTableProps {
  watchlistId: string
  watchlistName: string
  onItemAdded?: () => void
}

export function WatchlistTable({ watchlistId, watchlistName, onItemAdded }: WatchlistTableProps) {
  const { convert, format, currency } = useCurrency()

  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [watchlistId])

  const fetchItems = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/watchlists/${watchlistId}/items`)

      if (!response.ok) {
        throw new Error('Failed to fetch watchlist items')
      }

      const data = await response.json()
      setItems(data.items || [])
    } catch (err: any) {
      console.error('[WatchlistTable] Fetch error:', err)
      toast.error('Failed to load watchlist items')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    setDeletingItemId(itemId)

    try {
      const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete item')
      }

      // Optimistic update
      setItems((prev) => prev.filter((item) => item.id !== itemId))
      toast.success('Item removed from watchlist')

      // Notify parent to refetch watchlist counts
      if (onItemAdded) {
        onItemAdded()
      }
    } catch (err: any) {
      console.error('[WatchlistTable] Delete error:', err)
      toast.error('Failed to remove item')
    } finally {
      setDeletingItemId(null)
    }
  }

  const calculateDiff = (latestPrice: number | null, targetPrice: number | null) => {
    if (!latestPrice || !targetPrice) return null

    const latest = parseFloat(latestPrice.toString())
    const target = parseFloat(targetPrice.toString())

    const diffPercent = ((latest - target) / target) * 100
    return diffPercent
  }

  const formatRelativeDate = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return '1d ago'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return `${Math.floor(diffDays / 30)}mo ago`
  }

  const handleItemAdded = () => {
    fetchItems()
    if (onItemAdded) {
      onItemAdded()
    }
  }

  if (loading) {
    return (
      <Card elevation={1} className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card elevation={1} className="p-12 text-center">
        <Package className="h-12 w-12 mx-auto text-dim mb-4" />
        <p className="text-fg font-medium">No items in this watchlist</p>
        <p className="text-sm text-dim mt-2 mb-4">
          Add SKUs to track prices and get notified when they hit your targets
        </p>
        <Button
          onClick={() => setAddDialogOpen(true)}
          variant="outline"
          className="border-accent-400/50 text-accent hover:bg-accent/10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>

        <AddToWatchlistDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          watchlistId={watchlistId}
          watchlistName={watchlistName}
          onItemAdded={handleItemAdded}
        />
      </Card>
    )
  }

  return (
    <>
      <Card elevation={1} className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-fg">{watchlistName}</h2>
            <p className="text-xs text-muted mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={() => setAddDialogOpen(true)}
            variant="outline"
            size="sm"
            className="border-accent-400/50 text-accent hover:bg-accent/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="label-up">Product</TableHead>
                <TableHead className="label-up">Size</TableHead>
                <TableHead className="label-up">Latest Price</TableHead>
                <TableHead className="label-up">Target</TableHead>
                <TableHead className="label-up">Diff %</TableHead>
                <TableHead className="label-up">Source</TableHead>
                <TableHead className="text-right label-up">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const diff = calculateDiff(item.latest_price, item.target_price)
                const latestPriceGBP = item.latest_price
                  ? parseFloat(item.latest_price.toString())
                  : null
                const targetPriceGBP = item.target_price
                  ? parseFloat(item.target_price.toString())
                  : null

                return (
                  <TableRow key={item.id} className="group">
                    {/* Product */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.product_catalog?.image_url && (
                          <img
                            src={item.product_catalog.image_url}
                            alt={item.sku}
                            className="h-12 w-12 rounded object-cover border border-border"
                          />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/portfolio/market?sku=${item.sku}`}
                            className="group/link flex items-center gap-1.5 hover:text-accent transition-colors"
                          >
                            <p className="text-sm font-medium text-fg truncate">
                              {item.product_catalog?.brand} {item.product_catalog?.model}
                            </p>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                          </Link>
                          <p className="text-xs text-muted mono">{item.sku}</p>
                          {item.product_catalog?.colorway && (
                            <p className="text-xs text-dim mt-0.5">
                              {item.product_catalog.colorway}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Size */}
                    <TableCell className="mono">
                      <span className="text-sm text-fg">
                        {item.size || '—'}
                      </span>
                    </TableCell>

                    {/* Latest Price */}
                    <TableCell className="mono">
                      {latestPriceGBP ? (
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-fg">
                            {format(convert(latestPriceGBP, 'GBP'))}
                          </span>
                          {item.alert && (
                            <Badge className="ml-2 money-pos-tint text-xs">
                              Target met
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted">No data</span>
                      )}
                    </TableCell>

                    {/* Target Price */}
                    <TableCell className="mono">
                      {targetPriceGBP ? (
                        <span className="text-sm text-fg">
                          {format(convert(targetPriceGBP, 'GBP'))}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TableCell>

                    {/* Diff % */}
                    <TableCell className="mono">
                      {diff !== null ? (
                        <div className="flex items-center gap-1">
                          {diff > 0 ? (
                            <>
                              <TrendingUp className="h-3 w-3 money-neg" />
                              <span className="text-sm money-neg font-medium">
                                +{diff.toFixed(1)}%
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-3 w-3 money-pos" />
                              <span className="text-sm money-pos font-medium">
                                {diff.toFixed(1)}%
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TableCell>

                    {/* Source & As Of */}
                    <TableCell>
                      {item.latest_source && item.latest_as_of ? (
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-xs">
                            {item.latest_source}
                          </Badge>
                          <p className="text-xs text-muted">
                            {formatRelativeDate(item.latest_as_of)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/10 hover:text-danger"
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={deletingItemId === item.id}
                        aria-label="Remove item"
                      >
                        {deletingItemId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AddToWatchlistDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        watchlistId={watchlistId}
        watchlistName={watchlistName}
        onItemAdded={handleItemAdded}
      />
    </>
  )
}
