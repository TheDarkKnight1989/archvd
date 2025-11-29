'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useUserSettings } from '@/hooks/useUserSettings'

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

// Platform options matching database constraint and validation schema
const PLATFORMS = [
  { value: 'stockx', label: 'StockX' },
  { value: 'goat', label: 'Alias' },
  { value: 'ebay', label: 'eBay' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'vinted', label: 'Vinted' },
  { value: 'depop', label: 'Depop' },
  { value: 'private', label: 'Private Sale' },
  { value: 'other', label: 'Other' },
] as const

export function MarkAsSoldModal({ open, onOpenChange, item, onSuccess }: MarkAsSoldModalProps) {
  const router = useRouter()
  const { settings } = useUserSettings()
  const [soldPrice, setSoldPrice] = useState('')
  const [soldCurrency, setSoldCurrency] = useState<'GBP' | 'EUR' | 'USD'>('GBP')
  const [soldPlatform, setSoldPlatform] = useState('')
  const [soldFees, setSoldFees] = useState('')
  const [soldShipping, setSoldShipping] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-calculate fees based on platform and user settings
  useEffect(() => {
    const price = parseFloat(soldPrice) || 0
    if (price <= 0) return

    if (soldPlatform === 'stockx') {
      // StockX fee calculation
      const sellerLevel = settings?.stockx_seller_level || 1
      const transactionFee = sellerLevel === 1 ? 0.09 :
                            sellerLevel === 2 ? 0.085 :
                            sellerLevel === 3 ? 0.08 :
                            sellerLevel === 4 ? 0.075 : 0.07
      const processingFee = 0.03
      const totalPercentage = transactionFee + processingFee
      const percentageFees = price * totalPercentage

      setSoldFees(percentageFees.toFixed(2))
      setSoldShipping('4.00') // £4 shipping
    } else if (soldPlatform === 'goat') {
      // Alias (GOAT) fee calculation
      const commissionFee = (settings?.alias_commission_fee || 9.5) / 100
      const cashOutFee = 0.029
      const totalPercentage = commissionFee + cashOutFee
      const percentageFees = price * totalPercentage

      // Get seller fee based on region and shipping method
      const region = settings?.alias_region || 'uk'
      const method = settings?.alias_shipping_method || 'dropoff'
      const sellerFees: Record<string, { dropoff: number; prepaid: number }> = {
        uk: { dropoff: 2, prepaid: 5 },
        de: { dropoff: 2, prepaid: 5 },
        nl: { dropoff: 3, prepaid: 6 },
        fr: { dropoff: 6, prepaid: 6 },
        at: { dropoff: 6, prepaid: 6 },
        be: { dropoff: 6, prepaid: 6 },
        it: { dropoff: 8, prepaid: 8 },
        es: { dropoff: 8, prepaid: 8 },
      }
      const sellerFee = sellerFees[region]?.[method as 'dropoff' | 'prepaid'] || 0

      setSoldFees((percentageFees + sellerFee).toFixed(2))
      setSoldShipping('0.00') // Seller fee already includes shipping
    }
  }, [soldPrice, soldPlatform, settings])

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
          ...(soldPlatform && { platform: soldPlatform }),
          fees: feesNum,
          shipping: shippingNum,
          ...(notes && { notes }),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error information if available
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to mark as sold'
        throw new Error(errorMsg)
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
        <DialogContent className="max-w-[600px] w-[95vw] max-h-[95vh] rounded-2xl border-0 bg-[#111111]/95 backdrop-blur-md p-0 overflow-hidden shadow-2xl">
          <div className="border-b border-[#2a2a2a] px-8 py-6">
            <DialogTitle className="text-xl font-bold text-white">Mark as Sold</DialogTitle>
            <p className="text-sm text-gray-400 mt-1">
              {item.brand} {item.model} · {item.sku}
            </p>
          </div>

          <div className="px-8 py-6 space-y-5 max-h-[calc(95vh-240px)] overflow-y-auto">
            {/* Sold Price & Currency */}
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <Label htmlFor="soldPrice" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Sold Price <span className="text-[#00FF87]">*</span>
                </Label>
                <Input
                  id="soldPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200 num text-right tabular-nums"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="currency" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Currency
                </Label>
                <Select value={soldCurrency} onValueChange={(v: any) => setSoldCurrency(v)}>
                  <SelectTrigger className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                    <SelectItem value="GBP" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">GBP (£)</SelectItem>
                    <SelectItem value="EUR" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">EUR (€)</SelectItem>
                    <SelectItem value="USD" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform */}
            <div>
              <Label htmlFor="platform" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                Platform
              </Label>
              <Select value={soldPlatform} onValueChange={setSoldPlatform}>
                <SelectTrigger className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]">
                  <SelectValue placeholder="Select platform..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value} className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fees */}
            <div>
              <Label htmlFor="fees" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
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
                className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200 num text-right tabular-nums"
              />
              {(soldPlatform === 'stockx' || soldPlatform === 'goat') && soldFees && (
                <p className="text-xs text-[#00FF87] mt-1.5">
                  ✓ Auto-calculated based on your {soldPlatform === 'stockx' ? 'StockX' : 'Alias'} settings
                </p>
              )}
            </div>

            {/* Shipping */}
            <div>
              <Label htmlFor="shipping" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
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
                className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200 num text-right tabular-nums"
              />
              {soldPlatform === 'stockx' && soldShipping && (
                <p className="text-xs text-[#00FF87] mt-1.5">
                  ✓ Auto-calculated (£4 standard shipping)
                </p>
              )}
            </div>

            {/* Sold Date */}
            <div>
              <Label htmlFor="soldDate" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                Sold Date <span className="text-[#00FF87]">*</span>
              </Label>
              <Input
                id="soldDate"
                type="date"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200 num"
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the sale..."
                rows={3}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl resize-none focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
              />
            </div>

            {/* Margin Preview */}
            {soldPrice && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Purchase Total:</span>
                  <span className="num text-white font-medium">£{purchaseTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Sold Price:</span>
                  <span className="num text-white font-medium">£{soldPriceNum.toFixed(2)}</span>
                </div>
                {feesNum > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Fees:</span>
                    <span className="num text-white font-medium">-£{feesNum.toFixed(2)}</span>
                  </div>
                )}
                {shippingNum > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Shipping:</span>
                    <span className="num text-white font-medium">-£{shippingNum.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-[#2a2a2a] pt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin:</span>
                  <div className="flex items-center gap-2">
                    {margin >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-[#00FF87]" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                    <span className={cn(
                      "text-base num font-semibold",
                      margin >= 0 ? "text-[#00FF87]" : "text-red-400"
                    )}>
                      {margin >= 0 ? '+' : ''}£{margin.toFixed(2)}
                    </span>
                    <span className={cn(
                      "text-sm num",
                      margin >= 0 ? "text-[#00FF87]" : "text-red-400"
                    )}>
                      ({marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#2a2a2a] px-8 py-5 flex justify-end gap-3 bg-[#0f0f0f]">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white hover:bg-[#1a1a1a] font-semibold px-6 h-11 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !soldPrice || parseFloat(soldPrice) <= 0}
              className="bg-[#00FF87] hover:bg-[#00e67a] text-black font-bold px-8 h-11 rounded-xl shadow-lg hover:shadow-[#00FF87]/20 transition-all duration-200"
            >
              {isSubmitting ? 'Saving...' : 'Mark as Sold'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
