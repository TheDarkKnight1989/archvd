'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
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
  const router = useRouter()
  const [soldPrice, setSoldPrice] = useState('')
  const [soldCurrency, setSoldCurrency] = useState<'GBP' | 'EUR' | 'USD'>('GBP')
  const [soldPlatform, setSoldPlatform] = useState('')
  const [soldFees, setSoldFees] = useState('')
  const [soldShipping, setSoldShipping] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate margin
  const purchaseTotal = (item?.purchase_price || 0) + (item?.tax || 0) + (item?.shipping || 0)
  const soldPriceNum = parseFloat(soldPrice) || 0
  const feesNum = parseFloat(soldFees) || 0
  const shippingNum = parseFloat(soldShipping) || 0
  const margin = soldPriceNum - purchaseTotal - feesNum - shippingNum
  const marginPct = purchaseTotal > 0 ? (margin / purchaseTotal) * 100 : 0

  const handleSubmit = async () => {
    if (!item || !soldPrice || parseFloat(soldPrice) <= 0) {
      toast.error('Please enter a valid sold price')
      return
    }

    if (!soldDate) {
      toast.error('Please select a sold date')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/items/${item.id}/mark-sold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sold_price: parseFloat(soldPrice),
          sold_date: soldDate,
          sale_currency: soldCurrency,
          platform: soldPlatform || null,
          fees: feesNum,
          shipping: shippingNum,
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark as sold')
      }

      // Show success toast with link to sales page
      toast.success('Moved to Sales', {
        description: `${item.brand} ${item.model}`,
        action: {
          label: 'View',
          onClick: () => router.push('/portfolio/sales')
        },
      })

      // Call onSuccess to refresh inventory
      onSuccess?.()

      // Close modal and reset form
      onOpenChange(false)
      setSoldPrice('')
      setSoldCurrency('GBP')
      setSoldPlatform('')
      setSoldFees('')
      setSoldShipping('')
      setNotes('')
      setSoldDate(new Date().toISOString().split('T')[0])
    } catch (error: any) {
      console.error('Mark as sold error:', error)
      toast.error(error.message || 'Failed to mark as sold')
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
            {/* Sold Price & Currency */}
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <Label htmlFor="soldPrice" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                  Sold Price <span className="text-accent">*</span>
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
              <div>
                <Label htmlFor="currency" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                  Currency
                </Label>
                <Select value={soldCurrency} onValueChange={(v: any) => setSoldCurrency(v)}>
                  <SelectTrigger className="h-10 text-sm bg-elev-1 border-border text-fg rounded-lg px-3 focus:border-accent/50 focus:glow-accent-hover transition-all duration-120">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-elev-1 border-border">
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

            {/* Shipping */}
            <div>
              <Label htmlFor="shipping" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Shipping (£)
              </Label>
              <Input
                id="shipping"
                type="number"
                step="0.01"
                min="0"
                value={soldShipping}
                onChange={(e) => setSoldShipping(e.target.value)}
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

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-[11px] uppercase tracking-wider text-dim font-semibold mb-1 block">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the sale..."
                rows={3}
                className="text-sm bg-elev-1 border-border text-fg rounded-lg px-3 py-2 resize-none focus:border-accent/50 focus:glow-accent-hover transition-all duration-120"
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
                {shippingNum > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dim">Shipping:</span>
                    <span className="font-mono text-fg">-£{shippingNum.toFixed(2)}</span>
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
    </>
  )
}
