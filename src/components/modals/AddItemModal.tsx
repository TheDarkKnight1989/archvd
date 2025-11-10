'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SizeSelector } from '@/components/forms/SizeSelector'
import { TagInput } from '@/components/forms/TagInput'
import { WatchlistCombobox } from '@/components/forms/WatchlistCombobox'
import { Toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { listWatchlists } from '@/lib/supabase/items'
import { Loader2 } from 'lucide-react'

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

// Common input styles
const inputClassName = cn(
  "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3 placeholder:opacity-60",
  "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)] focus:border-accent/50",
  "transition-all duration-[120ms] ease-out"
)

const labelClassName = "font-cinzel text-accent uppercase tracking-wider text-xs mb-2 block"

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
        <DialogContent className="max-w-[720px] w-[90vw] rounded-2xl border border-border bg-elev-3/95 backdrop-blur-md shadow-[0_0_32px_rgba(0,255,148,0.15)] p-0 max-h-[calc(100vh-60px)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/20">
            <DialogTitle className="text-2xl font-cinzel font-bold text-fg">
              Add Item
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(100vh-200px)] px-6 py-4">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* COLUMN 1: Basic Info + Category/Size */}
              <div className="space-y-4">
                {/* Basic Information Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-cinzel text-accent uppercase tracking-wider text-xs">
                      Basic Information
                    </h3>
                    <div className="h-[2px] w-12 bg-accent/40 rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* Name */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="name" className={labelClassName}>
                        Name <span className="text-accent">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="e.g., Air Jordan 1 Retro High OG"
                        className={cn(inputClassName, errors.name && "border-danger")}
                      />
                      <div className="h-4 mt-1">
                        {errors.name && (
                          <p className="text-xs text-danger">{errors.name}</p>
                        )}
                      </div>
                    </div>

                    {/* Style ID */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="styleId" className={labelClassName}>
                        Style ID / SKU
                      </Label>
                      <Input
                        id="styleId"
                        value={formData.styleId}
                        onChange={(e) => updateField('styleId', e.target.value)}
                        onBlur={handleStyleIdBlur}
                        placeholder="e.g., DZ5485-612"
                        className={cn(inputClassName, "font-mono")}
                      />
                      <div className="h-4 mt-1">
                        {isLoadingMarket && (
                          <p className="text-xs text-accent">Looking up details...</p>
                        )}
                        {!isLoadingMarket && marketPreview && (
                          <p className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
                            <span className="text-accent">Market:</span>
                            <span className="font-mono font-semibold">£{marketPreview.price.toFixed(2)}</span>
                            <span className="text-dim">•</span>
                            <span className="capitalize">{marketPreview.source}</span>
                            <span className="text-dim">•</span>
                            <span>{formatRelativeTime(marketPreview.timestamp)}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Brand */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="brand" className={labelClassName}>
                        Brand
                      </Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => updateField('brand', e.target.value)}
                        placeholder="e.g., Nike"
                        className={inputClassName}
                      />
                    </div>

                    {/* Colorway */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="colorway" className={labelClassName}>
                        Colorway
                      </Label>
                      <Input
                        id="colorway"
                        value={formData.colorway}
                        onChange={(e) => updateField('colorway', e.target.value)}
                        placeholder="e.g., Chicago Lost & Found"
                        className={inputClassName}
                      />
                    </div>

                    {/* Condition */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="condition" className={labelClassName}>
                        Condition <span className="text-accent">*</span>
                      </Label>
                      <Select value={formData.condition} onValueChange={(value: any) => updateField('condition', value)}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-elev-1 border-border">
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

                {/* Category & Size Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-cinzel text-accent uppercase tracking-wider text-xs">
                      Category & Size
                    </h3>
                    <div className="h-[2px] w-12 bg-accent/40 rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* Category Pills */}
                    <div className="min-h-[70px]">
                      <Label className={labelClassName}>
                        Category <span className="text-accent">*</span>
                      </Label>
                      <div className="flex gap-2">
                        {(['shoes', 'clothes', 'other'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              updateField('category', cat)
                              updateField('size', '') // Reset size when category changes
                            }}
                            className={cn(
                              "flex-1 h-8 px-3 rounded-full text-sm font-medium transition-all duration-[200ms]",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
                              "hover:scale-105",
                              formData.category === cat
                                ? "bg-accent text-black shadow-[0_0_16px_rgba(0,255,148,0.4)]"
                                : "bg-elev-1 border border-border/30 text-muted hover:bg-elev-1 hover:border-accent/30"
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

                    {/* Other Size */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="sizeAlt" className={labelClassName}>
                        Other Size <span className="text-muted text-[10px] lowercase normal-case">(if not listed)</span>
                      </Label>
                      <Input
                        id="sizeAlt"
                        value={formData.sizeAlt}
                        onChange={(e) => updateField('sizeAlt', e.target.value)}
                        placeholder="e.g., 9.5W, 42EU"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: Purchase Info + Additional Info */}
              <div className="space-y-4">
                {/* Purchase Information Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-cinzel text-accent uppercase tracking-wider text-xs">
                      Purchase Information
                    </h3>
                    <div className="h-[2px] w-12 bg-accent/40 rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* Purchase Price */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="purchasePrice" className={labelClassName}>
                        Purchase Price (£) <span className="text-accent">*</span>
                      </Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.purchasePrice}
                        onChange={(e) => updateField('purchasePrice', e.target.value)}
                        placeholder="0.00"
                        className={cn(inputClassName, "font-mono text-right tabular-nums", errors.purchasePrice && "border-danger")}
                      />
                      <div className="h-4 mt-1">
                        {errors.purchasePrice && (
                          <p className="text-xs text-danger">{errors.purchasePrice}</p>
                        )}
                      </div>
                    </div>

                    {/* Purchase Date */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="purchaseDate" className={labelClassName}>
                        Purchase Date <span className="text-accent">*</span>
                      </Label>
                      <Input
                        id="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => updateField('purchaseDate', e.target.value)}
                        className={cn(inputClassName, "font-mono", errors.purchaseDate && "border-danger")}
                      />
                      <div className="h-4 mt-1">
                        {errors.purchaseDate && (
                          <p className="text-xs text-danger">{errors.purchaseDate}</p>
                        )}
                      </div>
                    </div>

                    {/* Tax */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="tax" className={labelClassName}>
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
                        className={cn(inputClassName, "font-mono text-right tabular-nums")}
                      />
                    </div>

                    {/* Shipping */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="shipping" className={labelClassName}>
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
                        className={cn(inputClassName, "font-mono text-right tabular-nums")}
                      />
                    </div>

                    {/* Purchase Total */}
                    <div className="bg-elev-1 border border-border/40 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-cinzel text-xs text-accent uppercase tracking-wider">Total</span>
                        <span className="text-base font-mono text-accent font-semibold tabular-nums">
                          £{purchaseTotal}
                        </span>
                      </div>
                    </div>

                    {/* Place of Purchase */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="placeOfPurchase" className={labelClassName}>
                        Place of Purchase
                      </Label>
                      <Select value={formData.placeOfPurchase} onValueChange={(value) => updateField('placeOfPurchase', value)}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent className="bg-elev-1 border-border">
                          {PLACE_OF_PURCHASE_OPTIONS.map(place => (
                            <SelectItem key={place} value={place}>
                              {place}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Order Number */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="orderNumber" className={labelClassName}>
                        Order Number
                      </Label>
                      <Input
                        id="orderNumber"
                        value={formData.orderNumber}
                        onChange={(e) => updateField('orderNumber', e.target.value)}
                        placeholder="Optional"
                        className={cn(inputClassName, "font-mono")}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-cinzel text-accent uppercase tracking-wider text-xs">
                      Additional Information
                    </h3>
                    <div className="h-[2px] w-12 bg-accent/40 rounded-full" />
                  </div>

                  <div className="space-y-3">
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
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id="customMarketToggle"
                          checked={showCustomMarket}
                          onChange={(e) => setShowCustomMarket(e.target.checked)}
                          className="w-4 h-4 rounded border-border/40 bg-elev-1 text-accent focus:ring-accent/25"
                        />
                        <Label htmlFor="customMarketToggle" className={cn(labelClassName, "mb-0 cursor-pointer")}>
                          Custom Market Value
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
                          className={cn(inputClassName, "font-mono text-right tabular-nums")}
                        />
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="notes" className={cn(labelClassName, "mb-0")}>
                          Notes
                        </Label>
                        <span className={cn(
                          "text-xs font-mono tabular-nums",
                          (formData.notes?.length || 0) > 250 ? "text-danger" : "text-muted"
                        )}>
                          {formData.notes?.length || 0}/250
                        </span>
                      </div>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => updateField('notes', e.target.value)}
                        placeholder="Any additional notes..."
                        rows={3}
                        maxLength={250}
                        className={cn(
                          "bg-elev-1 border border-border/40 text-fg text-sm resize-none p-3 rounded-lg placeholder:opacity-60",
                          "focus:ring-1 focus:ring-accent focus:shadow-[0_0_12px_rgba(0,255,148,0.2)] focus:border-accent/50",
                          "transition-all duration-[120ms] ease-out",
                          errors.notes && "border-danger"
                        )}
                      />
                      {errors.notes && (
                        <p className="text-xs text-danger mt-1">{errors.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
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
              type="button"
              variant="outline"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="border border-accent/40 text-accent hover:bg-accent/10 hover:shadow-[0_0_16px_rgba(0,255,148,0.3)] transition-all duration-[200ms]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Add Another'
              )}
            </Button>
            <Button
              type="submit"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="bg-accent text-black hover:bg-accent/90 hover:shadow-[0_0_16px_rgba(0,255,148,0.4)] transition-all duration-[200ms]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
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
