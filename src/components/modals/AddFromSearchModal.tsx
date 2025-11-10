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
import { Loader2, Minus, Plus } from 'lucide-react'

interface ProductPreview {
  sku: string
  brand: string
  model: string
  colorway: string
  imageUrl?: string
  latestPrice?: {
    price: number
    currency: string
    asOf: string
    source: string
  }
}

interface AddFromSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductPreview | null
  onSuccess?: () => void
}

export function AddFromSearchModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: AddFromSearchModalProps) {
  const { format } = useCurrency()
  const toast = useToast()
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingItems, setExistingItems] = useState<any[]>([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  // Check for duplicates when product changes
  useEffect(() => {
    if (!product?.sku || !open) {
      setExistingItems([])
      return
    }

    const checkDuplicates = async () => {
      setCheckingDuplicates(true)
      try {
        const res = await fetch(`/api/items?sku=${product.sku}`)
        if (res.ok) {
          const data = await res.json()
          setExistingItems(data.items || [])
        }
      } catch (error) {
        console.error('Failed to check for duplicates:', error)
      } finally {
        setCheckingDuplicates(false)
      }
    }

    checkDuplicates()
  }, [product?.sku, open])

  const handleSubmit = async () => {
    if (!product || !purchasePrice) {
      toast.error('Please enter a purchase price')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        sku: product.sku,
        name: product.model,
        brand: product.brand,
        model: product.model,
        colorway: product.colorway,
        category: 'pokemon', // Fixed category for Pokemon sealed
        condition: 'New', // Default to new for sealed products
        purchase_price: parseFloat(purchasePrice),
        purchase_date: purchaseDate,
        quantity: quantity,
        location: location || undefined,
        notes: notes || undefined,
        status: 'active',
      }

      const res = await fetch('/api/items/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to add item')
      }

      toast.success(`Added ${quantity} × ${product.model} to portfolio!`)

      // Reset form
      setQuantity(1)
      setPurchasePrice('')
      setLocation('')
      setNotes('')

      onSuccess?.()

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false)
      }, 1500)
    } catch (error: any) {
      // Log error for observability
      console.error('[AddToPortfolio] Error:', {
        sku: product.sku,
        quantity,
        purchasePrice,
        error: error.message,
        stack: error.stack,
      })
      toast.error(error.message || 'Failed to add item. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!product) return null

  // Handle Enter key to submit (only when not in an input field)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    // Don't submit if user is typing in an input (allow natural input behavior)
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return
    }

    if (e.key === 'Enter' && !isSubmitting && purchasePrice) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-[500px] w-[90vw] rounded-2xl border border-border bg-elev-3/95 backdrop-blur-md",
            "shadow-[0_0_32px_rgba(0,255,148,0.15)] p-0 overflow-y-auto max-h-[90vh]",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
          onKeyDown={handleKeyDown}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20">
            <DialogTitle className="text-2xl font-cinzel font-bold text-fg">
              Add to Portfolio
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-6">
            {/* Product Preview */}
            <div className="flex items-start gap-4 p-4 bg-elev-2 rounded-2xl border border-border/20">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.model}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-fg text-base truncate">
                  {product.brand} {product.model}
                </p>
                <p className="text-sm text-muted truncate mt-1">{product.colorway}</p>
                <Badge variant="outline" className="font-mono text-xs mt-2">
                  {product.sku}
                </Badge>
              </div>
            </div>

            {/* Duplicate Warning */}
            {existingItems.length > 0 && !checkingDuplicates && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                    <span className="text-amber-500 text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-500">
                      You already own {existingItems.length} {existingItems.length === 1 ? 'copy' : 'copies'} of this item
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Adding will create a new entry. To update quantity,{' '}
                      <a
                        href={`/portfolio?editItem=${existingItems[0].id}`}
                        className="text-accent hover:underline font-medium"
                        onClick={(e) => {
                          e.preventDefault()
                          window.location.href = `/portfolio?editItem=${existingItems[0].id}`
                        }}
                      >
                        edit the existing item
                      </a>{' '}
                      instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Latest Market Price Reference */}
            {product.latestPrice && (
              <div className="p-3 bg-elev-1 border border-border/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted uppercase tracking-wider font-cinzel">
                    Latest Market
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-mono font-semibold text-accent tabular-nums">
                      {format(product.latestPrice.price)}
                    </p>
                    <p className="text-xs text-muted capitalize">
                      {product.latestPrice.source}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Quantity */}
              <div>
                <Label htmlFor="quantity" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Quantity
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="h-10 w-10 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={cn(
                      "h-10 text-center font-mono text-lg font-semibold tabular-nums",
                      "bg-elev-1 border border-border/40 rounded-lg"
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-10 w-10 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Purchase Price */}
              <div>
                <Label htmlFor="purchasePrice" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Purchase Price (£) <span className="text-accent">*</span>
                </Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                    "font-mono text-right tabular-nums placeholder:opacity-60",
                    "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)]",
                    "transition-all duration-[120ms] ease-out"
                  )}
                  autoFocus
                />
              </div>

              {/* Purchase Date */}
              <div>
                <Label htmlFor="purchaseDate" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Purchase Date
                </Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={cn(
                    "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                    "font-mono"
                  )}
                />
              </div>

              {/* Location */}
              <div>
                <Label htmlFor="location" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Location <span className="text-muted text-[10px] lowercase normal-case">(optional)</span>
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Warehouse A, Shelf 3"
                  className={cn(
                    "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                    "placeholder:opacity-60"
                  )}
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block">
                  Notes <span className="text-muted text-[10px] lowercase normal-case">(optional)</span>
                </Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className={cn(
                    "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3",
                    "placeholder:opacity-60"
                  )}
                />
              </div>
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
              disabled={isSubmitting || !purchasePrice}
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
                'Add to Portfolio'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
