'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SizeSelector } from '@/components/forms/SizeSelector'
import { TagInput } from '@/components/forms/TagInput'
import { WatchlistCombobox } from '@/components/forms/WatchlistCombobox'
import { ModalFooter } from '@/components/modals/ModalFooter'
import { Toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { listWatchlists } from '@/lib/supabase/items'

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  styleId: z.string().optional(),
  brand: z.string().optional(),
  colorway: z.string().optional(),
  condition: z.enum(['new', 'used', 'worn', 'defect']),
  category: z.enum(['shoes', 'clothes', 'other']),
  size: z.string().optional(),
  sizeAlt: z.string().optional(),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  tax: z.string().optional(),
  shipping: z.string().optional(),
  placeOfPurchase: z.string().optional(),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  tags: z.array(z.string()),
  orderNumber: z.string().optional(),
  watchlist: z.string().optional(),
  customMarketValue: z.string().optional(),
  notes: z.string().max(250, "Notes must be 250 characters or less").optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'worn', label: 'Worn' },
  { value: 'defect', label: 'Defect' },
]

const PLACE_OF_PURCHASE_OPTIONS = [
  'SNKRS',
  'StockX',
  'GOAT',
  'eBay',
  'Retail',
  'Other',
]

// Mock watchlist options
const MOCK_WATCHLISTS = [
  { value: 'grails', label: 'Grails' },
  { value: 'summer-2025', label: 'Summer 2025' },
  { value: 'jordan-collection', label: 'Jordan Collection' },
]

// Helper function to format relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function AddItemModal({ open, onOpenChange, onSuccess }: AddItemModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    styleId: '',
    brand: '',
    colorway: '',
    condition: 'new',
    category: 'shoes',
    size: '',
    sizeAlt: '',
    purchasePrice: '',
    tax: '',
    shipping: '',
    placeOfPurchase: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    tags: [],
    orderNumber: '',
    watchlist: '',
    customMarketValue: '',
    notes: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCustomMarket, setShowCustomMarket] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'default' | 'success' | 'error' } | null>(null)
  const [watchlists, setWatchlists] = useState(MOCK_WATCHLISTS)
  const [isLoadingMarket, setIsLoadingMarket] = useState(false)
  const [marketPreview, setMarketPreview] = useState<{
    price: number
    source: string
    timestamp: string
  } | null>(null)

  // Load watchlists from database
  useEffect(() => {
    if (open) {
      listWatchlists()
        .then(data => {
          const formatted = data.map(c => ({ value: c.id, label: c.name }))
          setWatchlists(formatted)
        })
        .catch(err => console.error('Failed to load watchlists:', err))
    }
  }, [open])

  // Computed subtotal
  const purchaseTotal = (
    parseFloat(formData.purchasePrice || '0') +
    parseFloat(formData.tax || '0') +
    parseFloat(formData.shipping || '0')
  ).toFixed(2)

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleStyleIdBlur = async () => {
    const sku = formData.styleId?.trim()
    if (!sku) return

    setIsLoadingMarket(true)
    setMarketPreview(null)

    try {
      // Call real pricing API
      const category = formData.category === 'shoes' ? 'sneaker' : 'other'
      const response = await fetch(`/api/pricing/quick?sku=${encodeURIComponent(sku)}&category=${category}`)

      if (!response.ok) {
        throw new Error('Failed to fetch pricing data')
      }

      const data = await response.json()

      // Prefill product fields if available and empty
      if (data.product) {
        if (!formData.brand && data.product.brand) {
          updateField('brand', data.product.brand)
        }
        if (!formData.name && data.product.name) {
          updateField('name', data.product.name)
        }
        if (!formData.colorway && data.product.colorway) {
          updateField('colorway', data.product.colorway)
        }
      }

      // Store market preview if price available
      if (data.price && data.price.amount) {
        setMarketPreview({
          price: data.price.amount,
          source: data.sources_used?.[0] || 'Unknown',
          timestamp: data.price.timestamp,
        })
      }
    } catch (error) {
      console.error('Market lookup failed:', error)
      // Don't block submit on API failure - just log it
    } finally {
      setIsLoadingMarket(false)
    }
  }

  const validateForm = (): boolean => {
    try {
      formSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof FormData, string>> = {}
        error.issues.forEach((err) => {
          const field = err.path[0] as keyof FormData
          newErrors[field] = err.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleSubmit = async (addAnother: boolean = false) => {
    if (!validateForm()) {
      setToast({
        message: 'Please fix the errors before saving',
        variant: 'error'
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Transform form data to match API schema
      const payload = {
        sku: formData.styleId || formData.name, // Use styleId as SKU, fallback to name
        name: formData.name,
        purchase_price: parseFloat(formData.purchasePrice),
        style_id: formData.styleId || undefined,
        brand: formData.brand || undefined,
        model: formData.name, // Use name as model
        colorway: formData.colorway || undefined,
        condition: formData.condition ? (formData.condition.charAt(0).toUpperCase() + formData.condition.slice(1)) as 'New' | 'Used' | 'Worn' | 'Defect' : undefined,
        category: formData.category === 'shoes' ? 'sneaker' : formData.category,
        size_uk: formData.size || undefined,
        size_alt: formData.sizeAlt || undefined,
        tax: formData.tax ? parseFloat(formData.tax) : undefined,
        shipping: formData.shipping ? parseFloat(formData.shipping) : undefined,
        place_of_purchase: formData.placeOfPurchase || undefined,
        purchase_date: formData.purchaseDate || undefined,
        order_number: formData.orderNumber || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        watchlist_id: formData.watchlist || undefined,
        custom_market_value: formData.customMarketValue ? parseFloat(formData.customMarketValue) : undefined,
        notes: formData.notes || undefined,
      }

      // Call API
      const res = await fetch('/api/items/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const { error, issues } = await res.json()
        throw new Error(error || 'Failed to add item')
      }

      const { item } = await res.json()
      console.log('Item added:', item)

      setToast({
        message: 'Item added successfully!',
        variant: 'success'
      })

      // Call onSuccess to refresh inventory list
      onSuccess?.()

      if (addAnother) {
        // Reset form but keep category
        const category = formData.category
        setFormData({
          name: '',
          styleId: '',
          brand: '',
          colorway: '',
          condition: 'new',
          category,
          size: '',
          sizeAlt: '',
          purchasePrice: '',
          tax: '',
          shipping: '',
          placeOfPurchase: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          tags: [],
          orderNumber: '',
          watchlist: '',
          customMarketValue: '',
          notes: '',
        })
        setShowCustomMarket(false)
        setMarketPreview(null)
      } else {
        // Close modal after short delay
        setTimeout(() => {
          onOpenChange(false)
        }, 1500)
      }
    } catch (error: any) {
      console.error('Submit error:', error)
      setToast({
        message: error.message || 'Failed to add item. Please try again.',
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateWatchlist = (name: string) => {
    const newWatchlist = {
      value: name.toLowerCase().replace(/\s+/g, '-'),
      label: name
    }
    setWatchlists(prev => [...prev, newWatchlist])
    updateField('watchlist', newWatchlist.value)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0B1510] border-[#15251B] max-w-[calc(100vw-120px)] w-full max-h-[calc(100vh-60px)] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-[#15251B]/40">
            <DialogTitle className="text-2xl font-bold text-[#E8F6EE]">
              Add Item
            </DialogTitle>
          </DialogHeader>

          <div className="py-6">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* LEFT COLUMN */}
              <div className="space-y-8">
                {/* Basic Info Section */}
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold text-[#B7D0C2] uppercase tracking-wide">
                    Basic Information
                  </h3>

                  {/* Name - Full Width */}
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-[#B7D0C2]">
                      Name <span className="text-[#00FF94]">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g., Air Jordan 1 Retro High OG"
                      className={cn(
                        "mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 text-base",
                        "focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]",
                        errors.name && "border-[#FF4D5E]"
                      )}
                    />
                    {errors.name && (
                      <p className="text-xs text-[#FF4D5E] mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Style ID */}
                    <div>
                      <Label htmlFor="styleId" className="text-sm font-medium text-[#B7D0C2]">
                        Style ID / SKU
                      </Label>
                      <Input
                        id="styleId"
                        value={formData.styleId}
                        onChange={(e) => updateField('styleId', e.target.value)}
                        onBlur={handleStyleIdBlur}
                        placeholder="e.g., DZ5485-612"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 font-mono focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                      {isLoadingMarket && (
                        <p className="text-xs text-[#00FF94] mt-1">Looking up details...</p>
                      )}
                      {!isLoadingMarket && marketPreview && (
                        <p className="text-xs text-[#B7D0C2] mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#00FF94]">Market:</span>
                          <span className="font-semibold">£{marketPreview.price.toFixed(2)}</span>
                          <span className="text-[#7FA08F]">•</span>
                          <span className="capitalize">{marketPreview.source}</span>
                          <span className="text-[#7FA08F]">•</span>
                          <span>{formatRelativeTime(marketPreview.timestamp)}</span>
                        </p>
                      )}
                    </div>

                    {/* Brand */}
                    <div>
                      <Label htmlFor="brand" className="text-sm font-medium text-[#B7D0C2]">
                        Brand
                      </Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => updateField('brand', e.target.value)}
                        placeholder="e.g., Nike"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    </div>

                    {/* Colorway */}
                    <div>
                      <Label htmlFor="colorway" className="text-sm font-medium text-[#B7D0C2]">
                        Colorway
                      </Label>
                      <Input
                        id="colorway"
                        value={formData.colorway}
                        onChange={(e) => updateField('colorway', e.target.value)}
                        placeholder="e.g., Chicago Lost & Found"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    </div>

                    {/* Condition */}
                    <div>
                      <Label htmlFor="condition" className="text-sm font-medium text-[#B7D0C2]">
                        Condition <span className="text-[#00FF94]">*</span>
                      </Label>
                      <Select value={formData.condition} onValueChange={(value: any) => updateField('condition', value)}>
                        <SelectTrigger className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1A15] border-[#15251B]">
                          {CONDITION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Category & Size Section */}
                <div className="space-y-6 pt-6 border-t border-[#15251B]/40">
                  <h3 className="text-sm font-semibold text-[#B7D0C2] uppercase tracking-wide">
                    Category & Size
                  </h3>

                  {/* Category Tabs */}
                  <div>
                    <Label className="text-sm font-medium text-[#B7D0C2] mb-3 block">
                      Category <span className="text-[#00FF94]">*</span>
                    </Label>
                    <div className="flex gap-3">
                      {(['shoes', 'clothes', 'other'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            updateField('category', cat)
                            updateField('size', '') // Reset size when category changes
                          }}
                          className={cn(
                            "flex-1 px-6 py-3 rounded-lg text-base font-medium transition-all duration-[120ms]",
                            "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F8D65]/25",
                            formData.category === cat
                              ? "bg-[#00FF94] text-[#000000] border-[#00FF94] glow-accent-hover"
                              : "bg-[#08100C] text-[#B7D0C2] border-[#15251B] hover:bg-[#0B1510] hover:border-[#00FF94]/50 hover:text-[#E8F6EE]"
                          )}
                        >
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size Selector */}
                  <SizeSelector
                    value={formData.size}
                    onChange={(size) => updateField('size', size)}
                    category={formData.category}
                  />

                  {/* Add other size */}
                  <div>
                    <Label htmlFor="sizeAlt" className="text-sm font-medium text-[#B7D0C2]">
                      Other Size <span className="text-[#7FA08F] text-xs">(if not listed above)</span>
                    </Label>
                    <Input
                      id="sizeAlt"
                      value={formData.sizeAlt}
                      onChange={(e) => updateField('sizeAlt', e.target.value)}
                      placeholder="e.g., 9.5W, 42EU"
                      className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-8">
                {/* Purchase Info Section */}
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold text-[#B7D0C2] uppercase tracking-wide">
                    Purchase Information
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Purchase Price */}
                    <div>
                      <Label htmlFor="purchasePrice" className="text-sm font-medium text-[#B7D0C2]">
                        Purchase Price (£) <span className="text-[#00FF94]">*</span>
                      </Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.purchasePrice}
                        onChange={(e) => updateField('purchasePrice', e.target.value)}
                        placeholder="0.00"
                        className={cn(
                          "mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 num text-right text-base",
                          "focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]",
                          errors.purchasePrice && "border-[#FF4D5E]"
                        )}
                      />
                      {errors.purchasePrice && (
                        <p className="text-xs text-[#FF4D5E] mt-1">{errors.purchasePrice}</p>
                      )}
                    </div>

                    {/* Purchase Date */}
                    <div>
                      <Label htmlFor="purchaseDate" className="text-sm font-medium text-[#B7D0C2]">
                        Purchase Date <span className="text-[#00FF94]">*</span>
                      </Label>
                      <Input
                        id="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => updateField('purchaseDate', e.target.value)}
                        className={cn(
                          "mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 font-mono",
                          "focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]",
                          errors.purchaseDate && "border-[#FF4D5E]"
                        )}
                      />
                      {errors.purchaseDate && (
                        <p className="text-xs text-[#FF4D5E] mt-1">{errors.purchaseDate}</p>
                      )}
                    </div>

                    {/* Tax */}
                    <div>
                      <Label htmlFor="tax" className="text-sm font-medium text-[#B7D0C2]">
                        Tax (£)
                      </Label>
                      <Input
                        id="tax"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.tax}
                        onChange={(e) => updateField('tax', e.target.value)}
                        placeholder="0.00"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 num text-right text-base focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    </div>

                    {/* Shipping */}
                    <div>
                      <Label htmlFor="shipping" className="text-sm font-medium text-[#B7D0C2]">
                        Shipping (£)
                      </Label>
                      <Input
                        id="shipping"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.shipping}
                        onChange={(e) => updateField('shipping', e.target.value)}
                        placeholder="0.00"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 num text-right text-base focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    </div>
                  </div>

                  {/* Purchase Total */}
                  <div className="flex items-center justify-between p-4 bg-[#0E1A15] border-2 border-[#00FF94]/30 rounded-lg">
                    <span className="text-sm font-medium text-[#B7D0C2]">Total Purchase Cost:</span>
                    <span className="text-xl font-bold text-[#00FF94] font-mono">
                      £{purchaseTotal}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Place of Purchase */}
                    <div>
                      <Label htmlFor="placeOfPurchase" className="text-sm font-medium text-[#B7D0C2]">
                        Place of Purchase
                      </Label>
                      <Select value={formData.placeOfPurchase} onValueChange={(value) => updateField('placeOfPurchase', value)}>
                        <SelectTrigger className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E1A15] border-[#15251B]">
                          {PLACE_OF_PURCHASE_OPTIONS.map(place => (
                            <SelectItem key={place} value={place}>
                              {place}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Order Number */}
                    <div>
                      <Label htmlFor="orderNumber" className="text-sm font-medium text-[#B7D0C2]">
                        Order Number
                      </Label>
                      <Input
                        id="orderNumber"
                        value={formData.orderNumber}
                        onChange={(e) => updateField('orderNumber', e.target.value)}
                        placeholder="Optional"
                        className="mt-2 bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 font-mono focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Info Section */}
                <div className="space-y-6 pt-6 border-t border-[#15251B]/40">
                  <h3 className="text-sm font-semibold text-[#B7D0C2] uppercase tracking-wide">
                    Additional Information
                  </h3>

                  {/* Tags */}
                  <TagInput
                    value={formData.tags}
                    onChange={(tags) => updateField('tags', tags)}
                    placeholder="Type and press Enter to add tags"
                  />

                  {/* Watchlist */}
                  <WatchlistCombobox
                    value={formData.watchlist}
                    onChange={(value) => updateField('watchlist', value)}
                    options={watchlists}
                    onCreateNew={handleCreateWatchlist}
                  />

                  {/* Custom Market Value */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="customMarketToggle"
                        checked={showCustomMarket}
                        onChange={(e) => setShowCustomMarket(e.target.checked)}
                        className="w-5 h-5 rounded border-[#15251B] bg-[#08100C] text-[#00FF94] focus:ring-[#0F8D65]/25"
                      />
                      <Label htmlFor="customMarketToggle" className="text-sm font-medium text-[#B7D0C2] cursor-pointer">
                        Set custom market value
                      </Label>
                    </div>
                    {showCustomMarket && (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.customMarketValue}
                        onChange={(e) => updateField('customMarketValue', e.target.value)}
                        placeholder="0.00"
                        className="bg-[#08100C] border-[#15251B] text-[#E8F6EE] h-12 num text-right text-base focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]"
                      />
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label htmlFor="notes" className="text-sm font-medium text-[#B7D0C2]">
                        Notes
                      </Label>
                      <span className={cn(
                        "text-sm font-mono",
                        (formData.notes?.length || 0) > 250 ? "text-[#FF4D5E]" : "text-[#7FA08F]"
                      )}>
                        {formData.notes?.length || 0}/250
                      </span>
                    </div>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="Any additional notes..."
                      rows={4}
                      maxLength={250}
                      className={cn(
                        "bg-[#08100C] border-[#15251B] text-[#E8F6EE] text-base resize-none p-4",
                        "focus:border-[#0F8D65]/50 focus:glow-accent-hover transition-all duration-[120ms]",
                        errors.notes && "border-[#FF4D5E]"
                      )}
                    />
                    {errors.notes && (
                      <p className="text-xs text-[#FF4D5E] mt-1">{errors.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <ModalFooter
            onCancel={() => onOpenChange(false)}
            onSave={() => handleSubmit(false)}
            onSaveAndAddAnother={() => handleSubmit(true)}
            isSubmitting={isSubmitting}
          />
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
