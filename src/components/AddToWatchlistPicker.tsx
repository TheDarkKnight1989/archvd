'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

type Watchlist = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

interface AddToWatchlistPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku: string
  defaultSize?: string
  defaultTargetPrice?: number
}

export function AddToWatchlistPicker({
  open,
  onOpenChange,
  sku,
  defaultSize,
  defaultTargetPrice,
}: AddToWatchlistPickerProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)

  // Form state
  const [size, setSize] = useState(defaultSize || '')
  const [targetPrice, setTargetPrice] = useState(defaultTargetPrice?.toString() || '')
  const [newWatchlistName, setNewWatchlistName] = useState('')

  useEffect(() => {
    if (open) {
      fetchWatchlists()
    }
  }, [open])

  const fetchWatchlists = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/watchlists')

      if (!response.ok) {
        throw new Error('Failed to fetch watchlists')
      }

      const data = await response.json()
      setWatchlists(data.watchlists || [])

      // Auto-select first watchlist if available
      if (data.watchlists && data.watchlists.length > 0 && !selectedWatchlistId) {
        setSelectedWatchlistId(data.watchlists[0].id)
      }
    } catch (err: any) {
      console.error('[AddToWatchlistPicker] Fetch error:', err)
      toast.error('Failed to load watchlists')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) {
      toast.error('Please enter a watchlist name')
      return
    }

    setAdding(true)

    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create watchlist')
      }

      const data = await response.json()

      // Add to local list and select it
      setWatchlists((prev) => [data.watchlist, ...prev])
      setSelectedWatchlistId(data.watchlist.id)
      setCreatingNew(false)
      setNewWatchlistName('')

      toast.success(`Created watchlist "${newWatchlistName}"`)
    } catch (err: any) {
      console.error('[AddToWatchlistPicker] Create error:', err)
      toast.error(err.message || 'Failed to create watchlist')
    } finally {
      setAdding(false)
    }
  }

  const handleAddToWatchlist = async () => {
    if (!selectedWatchlistId) {
      toast.error('Please select a watchlist')
      return
    }

    const targetPriceNum = targetPrice ? parseFloat(targetPrice) : null
    if (targetPrice && (isNaN(targetPriceNum!) || targetPriceNum! < 0)) {
      toast.error('Target price must be a valid positive number')
      return
    }

    setAdding(true)

    try {
      const response = await fetch(`/api/watchlists/${selectedWatchlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: sku.toUpperCase().trim(),
          size: size.trim() || null,
          target_price: targetPriceNum,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add item')
      }

      const watchlist = watchlists.find((w) => w.id === selectedWatchlistId)
      toast.success(`Added to "${watchlist?.name || 'watchlist'}"`)

      // Reset and close
      setSize('')
      setTargetPrice('')
      onOpenChange(false)
    } catch (err: any) {
      console.error('[AddToWatchlistPicker] Add error:', err)
      toast.error(err.message || 'Failed to add to watchlist')
    } finally {
      setAdding(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !adding) {
      setSize(defaultSize || '')
      setTargetPrice(defaultTargetPrice?.toString() || '')
      setCreatingNew(false)
      setNewWatchlistName('')
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
          <DialogDescription>
            Track {sku} and get notified when it hits your target price
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Watchlist Selection */}
          {!creatingNew && (
            <div className="space-y-2">
              <Label>Select Watchlist</Label>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : watchlists.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted mb-3">No watchlists yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreatingNew(true)}
                    className="border-accent/50 text-accent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Watchlist
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {watchlists.map((watchlist) => (
                      <button
                        key={watchlist.id}
                        onClick={() => setSelectedWatchlistId(watchlist.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                          selectedWatchlistId === watchlist.id
                            ? 'border-accent bg-accent/10'
                            : 'border-border hover:border-accent/50 hover:bg-elev-2'
                        )}
                      >
                        <Bookmark
                          className={cn(
                            'h-4 w-4',
                            selectedWatchlistId === watchlist.id
                              ? 'text-accent fill-accent'
                              : 'text-muted'
                          )}
                        />
                        <span className="text-sm font-medium">{watchlist.name}</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreatingNew(true)}
                    className="w-full text-accent hover:text-accent-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Watchlist
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Create New Watchlist Form */}
          {creatingNew && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-watchlist-name">Watchlist Name</Label>
                <Input
                  id="new-watchlist-name"
                  placeholder="e.g., Grails, Summer 2025"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !adding) {
                      handleCreateWatchlist()
                    }
                  }}
                  disabled={adding}
                  className="bg-elev-1 border-border focus:ring-focus"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatingNew(false)
                    setNewWatchlistName('')
                  }}
                  disabled={adding}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateWatchlist}
                  disabled={adding || !newWatchlistName.trim()}
                  className="flex-1 bg-accent text-black hover:bg-accent-600"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Size (Optional) */}
          {!creatingNew && watchlists.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="size">Size (optional)</Label>
              <Input
                id="size"
                placeholder="e.g., UK9, US10, 42"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={adding}
                className="bg-elev-1 border-border focus:ring-focus"
              />
            </div>
          )}

          {/* Target Price (Optional) */}
          {!creatingNew && watchlists.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="target-price">Target Price (optional, GBP)</Label>
              <Input
                id="target-price"
                type="number"
                placeholder="e.g., 150"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                disabled={adding}
                className="bg-elev-1 border-border focus:border-accent-400 focus:ring-accent-400/20 font-mono"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted">
                You'll get notified when the price meets or goes below this target
              </p>
            </div>
          )}
        </div>

        {!creatingNew && watchlists.length > 0 && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToWatchlist}
              disabled={adding || !selectedWatchlistId}
              className="bg-accent text-black hover:bg-accent-600"
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add to Watchlist'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
