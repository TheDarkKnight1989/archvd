'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { useToast } from '@/contexts/ToastContext'
import { Loader2, Plus } from 'lucide-react'

interface ProductPreview {
  sku: string
  name: string
  subtitle: string
  imageUrl?: string
  latestPrice?: number
}

interface Watchlist {
  id: string
  name: string
}

interface AddToWatchlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductPreview | null
  onSuccess?: () => void
}

export function AddToWatchlistModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: AddToWatchlistModalProps) {
  const { format } = useCurrency()
  const toast = useToast()
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>('')
  const [targetPrice, setTargetPrice] = useState('')
  const [size, setSize] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingWatchlists, setIsLoadingWatchlists] = useState(false)
  const [showNewWatchlist, setShowNewWatchlist] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')

  // Fetch watchlists when modal opens
  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setTargetPrice('')
      setSize('')
      setShowNewWatchlist(false)
      setNewWatchlistName('')
      return
    }

    const fetchWatchlists = async () => {
      setIsLoadingWatchlists(true)
      try {
        const res = await fetch('/api/watchlists')
        if (res.ok) {
          const data = await res.json()
          setWatchlists(data.watchlists || [])

          // Auto-select first watchlist or default
          if (data.watchlists && data.watchlists.length > 0) {
            const defaultList = data.watchlists.find((w: Watchlist) => w.name === 'My Watchlist')
            setSelectedWatchlistId(defaultList?.id || data.watchlists[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch watchlists:', error)
        toast.error('Failed to load watchlists')
      } finally {
        setIsLoadingWatchlists(false)
      }
    }

    fetchWatchlists()
  }, [open, toast])

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) {
      toast.error('Please enter a watchlist name')
      return
    }

    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to create watchlist')
      }

      const { watchlist } = await res.json()
      setWatchlists([...watchlists, watchlist])
      setSelectedWatchlistId(watchlist.id)
      setShowNewWatchlist(false)
      setNewWatchlistName('')
      toast.success(`Created watchlist "${watchlist.name}"`)
    } catch (error: any) {
      console.error('Create watchlist error:', error)
      toast.error(error.message || 'Failed to create watchlist')
    }
  }

  const handleSubmit = async () => {
    if (!product) return

    if (!selectedWatchlistId && !showNewWatchlist) {
      toast.error('Please select a watchlist')
      return
    }

    setIsSubmitting(true)

    try {
      // If creating new watchlist, do that first
      if (showNewWatchlist) {
        await handleCreateWatchlist()
        // selectedWatchlistId will be updated by handleCreateWatchlist
      }

      const payload: any = {
        sku: product.sku,
      }

      if (targetPrice) {
        payload.target_price = parseFloat(targetPrice)
      }

      if (size) {
        payload.size = size
      }

      const res = await fetch(`/api/watchlists/${selectedWatchlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to add to watchlist')
      }

      toast.success(`Added ${product.name} to watchlist`)

      // Reset form
      setTargetPrice('')
      setSize('')

      onSuccess?.()

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 500)
    } catch (error: any) {
      // Log error for observability
      console.error('[AddToWatchlist] Error:', {
        sku: product.sku,
        watchlistId: selectedWatchlistId,
        error: error.message,
        stack: error.stack,
      })

      if (error.message.includes('already in your watchlist')) {
        toast.info(`${product.name} is already in this watchlist`)
      } else {
        toast.error(error.message || 'Failed to add to watchlist')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!product) return null

  const isPokemon = product.sku.startsWith('PKMN-')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-[500px] w-[90vw] rounded-2xl border border-border bg-elev-3/95 backdrop-blur-md",
        "shadow-[0_0_32px_rgba(0,255,148,0.15)] p-0 overflow-y-auto max-h-[90vh]",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20">
          <DialogTitle className="text-2xl font-cinzel font-bold text-fg">
            Add to Watchlist
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          {/* Product Preview */}
          <div className="flex items-start gap-4 p-4 bg-elev-2 rounded-2xl border border-border/20">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-fg text-base truncate">
                {product.name}
              </p>
              <p className="text-sm text-muted truncate mt-1">{product.subtitle}</p>
              <Badge variant="outline" className="font-mono text-xs mt-2">
                {product.sku}
              </Badge>
            </div>
          </div>

          {/* Latest Market Price Reference */}
          {product.latestPrice && (
            <div className="p-3 bg-elev-1 border border-border/40 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted uppercase tracking-wider font-cinzel">
                  Latest Market
                </span>
                <p className="text-sm font-mono font-semibold text-accent tabular-nums">
                  {format(product.latestPrice)}
                </p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Watchlist Selection */}
            <div>
              <Label className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                Watchlist <span className="text-accent">*</span>
              </Label>

              {isLoadingWatchlists ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted" />
                </div>
              ) : showNewWatchlist ? (
                <div className="space-y-2">
                  <Input
                    value={newWatchlistName}
                    onChange={(e) => setNewWatchlistName(e.target.value)}
                    placeholder="Enter watchlist name"
                    className={cn(
                      "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                      "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)]"
                    )}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowNewWatchlist(false)
                        setNewWatchlistName('')
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateWatchlist}
                      className="flex-1 bg-accent text-black hover:bg-accent/90"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedWatchlistId}
                    onChange={(e) => setSelectedWatchlistId(e.target.value)}
                    className={cn(
                      "w-full h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                      "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                      "transition-all duration-[120ms] ease-out"
                    )}
                  >
                    {watchlists.map((watchlist) => (
                      <option key={watchlist.id} value={watchlist.id}>
                        {watchlist.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewWatchlist(true)}
                    className="w-full border border-border/30 hover:bg-elev-1"
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Create New Watchlist
                  </Button>
                </div>
              )}
            </div>

            {/* Target Price */}
            <div>
              <Label htmlFor="targetPrice" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                Target Price (£) <span className="text-muted text-[10px] lowercase normal-case">(optional)</span>
              </Label>
              <Input
                id="targetPrice"
                type="number"
                step="0.01"
                min="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                  "font-mono text-right tabular-nums placeholder:opacity-60",
                  "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                  "transition-all duration-[120ms] ease-out"
                )}
              />
              {targetPrice && (
                <p className="text-xs text-muted mt-1">
                  You'll be notified when the price drops to or below this amount
                </p>
              )}
            </div>

            {/* Size (for sneakers only) */}
            {!isPokemon && (
              <div>
                <Label htmlFor="size" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Size <span className="text-muted text-[10px] lowercase normal-case">(optional)</span>
                </Label>
                <Input
                  id="size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g., UK 9, US 10"
                  className={cn(
                    "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                    "placeholder:opacity-60"
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border/20 p-4 bg-elev-2/70 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="border border-border/30 hover:bg-elev-1 transition-all duration-[200ms]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || (!selectedWatchlistId && !showNewWatchlist)}
            className={cn(
              "bg-accent text-black hover:bg-accent/90",
              "hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-[200ms]"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Watchlist'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
