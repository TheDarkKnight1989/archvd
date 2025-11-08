'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { Toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MarkAsSoldModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    id: string
    sku: string
    brand?: string | null
    model?: string | null
    purchase_price: number
    tax?: number | null
    shipping?: number | null
  } | null
  onSuccess?: () => void
}

const PLATFORMS = [
  'StockX',
  'GOAT',
  'eBay',
  'Depop',
  'Vinted',
  'Grailed',
  'Facebook',
  'Instagram',
  'In-Person',
  'Other',
]

export function MarkAsSoldModal({ open, onOpenChange, item, onSuccess }: MarkAsSoldModalProps) {
  const [soldPrice, setSoldPrice] = useState('')
  const [soldPlatform, setSoldPlatform] = useState('')
  const [soldFees, setSoldFees] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  // Calculate margin
  const purchaseTotal = (item?.purchase_price || 0) + (item?.tax || 0) + (item?.shipping || 0)
  const soldPriceNum = parseFloat(soldPrice) || 0
  const feesNum = parseFloat(soldFees) || 0
  const margin = soldPriceNum - purchaseTotal - feesNum
  const marginPct = purchaseTotal > 0 ? (margin / purchaseTotal) * 100 : 0

  const handleSubmit = async () => {
    if (!item || !soldPrice || parseFloat(soldPrice) <= 0) {
      setToast({ message: 'Please enter a valid sold price', variant: 'error' })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('Inventory')
        .update({
          status: 'sold',
          sold_price: parseFloat(soldPrice),
          platform: soldPlatform || null,
          sold_date: soldDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      if (error) throw error

      setToast({ message: 'Item marked as sold!', variant: 'success' })

      // Call onSuccess to refresh inventory
      onSuccess?.()

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false)
        // Reset form
        setSoldPrice('')
        setSoldPlatform('')
        setSoldFees('')
        setSoldDate(new Date().toISOString().split('T')[0])
      }, 1500)
    } catch (error: any) {
      console.error('Mark as sold error:', error)
      setToast({ message: error.message || 'Failed to mark as sold', variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!item) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[500px] w-full rounded-2xl border border-border bg-elev-2 shadow-soft p-6 md:p-7">
          <DialogHeader className="pb-4 border-b border-border/40">
            <DialogTitle className="text-xl font-bold text-fg">
              Mark as Sold
            </DialogTitle>
            <p className="text-sm text-muted mt-2">
              {item.brand} {item.model} · {item.sku}
            </p>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Sold Price */}
            <div>
              <Label htmlFor="soldPrice" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Sold Price (£) <span className="text-accent">*</span>
              </Label>
              <Input
                id="soldPrice"
                type="number"
                step="0.01"
                min="0"
                value={soldPrice}
                onChange={(e) => setSoldPrice(e.target.value)}
                placeholder="0.00"
                className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 num text-right tabular-nums focus:border-accent/50 focus:glow-accent-hover transition-all duration-120"
                autoFocus
              />
            </div>

            {/* Platform */}
            <div>
              <Label htmlFor="platform" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Platform
              </Label>
              <Select value={soldPlatform} onValueChange={setSoldPlatform}>
                <SelectTrigger className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 focus:border-accent/50 focus:glow-accent-hover transition-all duration-120">
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent className="bg-elev-1 border-border">
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fees */}
            <div>
              <Label htmlFor="fees" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Fees (£)
              </Label>
              <Input
                id="fees"
                type="number"
                step="0.01"
                min="0"
                value={soldFees}
                onChange={(e) => setSoldFees(e.target.value)}
                placeholder="0.00"
                className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 num text-right tabular-nums focus:border-accent/50 focus:glow-accent-hover transition-all duration-120"
              />
            </div>

            {/* Sold Date */}
            <div>
              <Label htmlFor="soldDate" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Sold Date <span className="text-accent">*</span>
              </Label>
              <Input
                id="soldDate"
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 font-mono focus:border-accent/50 focus:glow-accent-hover transition-all duration-120"
              />
            </div>

            {/* Margin Preview */}
            {soldPrice && (
              <div className="bg-elev-1 border border-border/40 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dim">Purchase Total:</span>
                  <span className="font-mono text-fg">£{purchaseTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dim">Sold Price:</span>
                  <span className="font-mono text-fg">£{soldPriceNum.toFixed(2)}</span>
                </div>
                {feesNum > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dim">Fees:</span>
                    <span className="font-mono text-fg">-£{feesNum.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                  <span className="text-xs text-dim uppercase tracking-wider">Margin:</span>
                  <div className="flex items-center gap-2">
                    {margin >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-danger" />
                    )}
                    <span className={cn(
                      "text-base font-mono font-semibold",
                      margin >= 0 ? "text-success" : "text-danger"
                    )}>
                      {margin >= 0 ? '+' : ''}£{margin.toFixed(2)}
                    </span>
                    <span className={cn(
                      "text-sm font-mono",
                      marginPct >= 0 ? "text-success" : "text-danger"
                    )}>
                      ({marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !soldPrice || parseFloat(soldPrice) <= 0}
              className="bg-accent text-black hover:bg-accent-600 glow-accent-hover"
            >
              {isSubmitting ? 'Saving...' : 'Mark as Sold'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
