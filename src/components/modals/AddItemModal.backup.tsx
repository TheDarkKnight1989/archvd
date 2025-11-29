'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Loader2, Package, Info } from 'lucide-react'

// STABILISATION MODE: Single-size only
// Form validation schema
const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  size: z.string().min(1, "Size is required"),
  sizeSystem: z.enum(['UK', 'US', 'EU']),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  tax: z.string().optional(),
  shipping: z.string().optional(),
  placeOfPurchase: z.string().optional(),
  orderNumber: z.string().optional(),
  condition: z.enum(['new', 'used', 'worn', 'defect']),
  notes: z.string().max(250, "Notes must be 250 characters or less").optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  editItem?: any // Item to edit (if provided, modal becomes edit mode)
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

const SHOE_SIZES_UK = [
  '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5',
  '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5',
  '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5',
  '15', '15.5', '16'
]

const SHOE_SIZES_US = [
  '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5',
  '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5',
  '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5',
  '16', '16.5', '17', '17.5', '18'
]

const SHOE_SIZES_EU = [
  '36', '36.5', '37', '37.5', '38', '38.5', '39', '40',
  '40.5', '41', '42', '42.5', '43', '44', '44.5', '45',
  '45.5', '46', '47', '47.5', '48', '48.5', '49', '49.5', '50'
]

// Common input styles
const inputClassName = cn(
  "h-10 text-sm bg-elev-1 border border-border/40 text-fg rounded-lg px-3 placeholder:opacity-60",
  "focus:ring-2 focus:ring-focus focus:border-accent/50",
  "transition-boutique"
)

const labelClassName = "font-display text-muted uppercase tracking-wide text-xs mb-2 block font-medium"

interface ProductPreview {
  productId: string
  title: string
  brand: string
  colorway: string
  image: string | null
  gender: string
  retailPrice: number | null
  releaseDate: string | null
  category: string
  marketData?: {
    lowestAsk: number | null
    highestBid: number | null
    currencyCode: string
  }
}

export function AddItemModal({ open, onOpenChange, onSuccess, editItem }: AddItemModalProps) {
  const { symbol, format } = useCurrency()

  // Determine if we're in edit mode
  // Edit mode: editItem exists AND has an id
  // Duplicate mode: editItem exists but NO id (pre-fills form, but creates new item)
  const isEditMode = !!editItem?.id

  // Load smart defaults from localStorage
  const loadSmartDefaults = () => ({
    sizeSystem: (localStorage.getItem('add_item_size_system') || 'UK') as 'UK' | 'US' | 'EU',
    tax: localStorage.getItem('add_item_tax') || '',
    shipping: localStorage.getItem('add_item_shipping') || '',
    placeOfPurchase: localStorage.getItem('add_item_place') || '',
  })

  const [formData, setFormData] = useState<FormData>({
    sku: '',
    size: '',
    sizeSystem: 'UK',
    purchasePrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    tax: '',
    shipping: '',
    placeOfPurchase: '',
    orderNumber: '',
    condition: 'new',
    notes: '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'default' | 'success' | 'error' } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [productPreview, setProductPreview] = useState<ProductPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [addAnother, setAddAnother] = useState(false)

  // Reset form when modal opens or populate from editItem
  useEffect(() => {
    if (open) {
      if (editItem) {
        // Edit mode: populate form with editItem data
        setFormData({
          sku: editItem.sku || '',
          size: editItem.size_uk?.toString() || '',
          sizeSystem: 'UK', // Default to UK
          purchasePrice: editItem.avgCost?.toString() || '',
          purchaseDate: editItem.purchaseDate || new Date().toISOString().split('T')[0],
          tax: '', // Not available in V3
          shipping: '', // Not available in V3
          placeOfPurchase: editItem.placeOfPurchase || '',
          orderNumber: editItem.orderNumber || '',
          condition: (editItem.condition as any) || 'new',
          notes: editItem.notes || '',
        })
        // Set product preview if available
        if (editItem.brand && editItem.model) {
          setProductPreview({
            productId: editItem.stockxProductId || '',
            title: `${editItem.brand} ${editItem.model}`,
            brand: editItem.brand,
            colorway: editItem.colorway || '',
            image: editItem.image?.url || editItem.imageUrl || null,
            gender: editItem.gender || '',
            retailPrice: editItem.retailPrice || null,
            releaseDate: editItem.releaseDate || null,
            category: editItem.category || '',
            marketData: editItem.market ? {
              lowestAsk: editItem.market.price || null,
              highestBid: editItem.market.highestBid || null,
              currencyCode: editItem.market.currencyCode || 'GBP',
            } : undefined,
          })
        }
      } else {
        // Add mode: load smart defaults
        const defaults = loadSmartDefaults()
        setFormData({
          sku: '',
          size: '',
          sizeSystem: defaults.sizeSystem,
          purchasePrice: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          tax: defaults.tax,
          shipping: defaults.shipping,
          placeOfPurchase: defaults.placeOfPurchase,
          orderNumber: '',
          condition: 'new',
          notes: '',
        })
        setProductPreview(null)
      }
      setPreviewError(null)
      setErrors({})
    }
  }, [open, isEditMode, editItem])

  // Fetch market data when product and size are both available
  useEffect(() => {
    const fetchMarketData = async () => {
      if (!productPreview || !formData.size || !formData.sku) return

      try {
        const response = await fetch(
          `/api/stockx/products/${encodeURIComponent(formData.sku)}/market-data?size=${encodeURIComponent(formData.size)}&sizeSystem=${formData.sizeSystem}`
        )

        if (!response.ok) return

        const data = await response.json()

        if (data.lowestAsk || data.highestBid) {
          setProductPreview(prev => prev ? {
            ...prev,
            marketData: {
              lowestAsk: data.lowestAsk,
              highestBid: data.highestBid,
              currencyCode: data.currency || 'GBP',
            }
          } : null)
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error)
      }
    }

    fetchMarketData()
  }, [productPreview?.productId, formData.size, formData.sku, formData.sizeSystem])

  // Computed subtotal
  const purchaseTotal = (
    parseFloat(formData.purchasePrice || '0') +
    parseFloat(formData.tax || '0') +
    parseFloat(formData.shipping || '0')
  ).toFixed(2)

  // Computed profit indicators
  const profitIndicator = (() => {
    if (!productPreview?.marketData || !formData.purchasePrice) return null

    const purchaseTotalNum = parseFloat(purchaseTotal)
    const lowestAsk = productPreview.marketData.lowestAsk || 0

    if (lowestAsk <= 0 || purchaseTotalNum <= 0) return null

    const estimatedProfit = lowestAsk - purchaseTotalNum
    const roi = (estimatedProfit / purchaseTotalNum) * 100

    // Determine color coding
    let colorClass = 'text-muted'
    if (roi >= 20) colorClass = 'text-success'
    else if (roi >= 10) colorClass = 'text-accent'
    else if (roi >= 0) colorClass = 'text-warning'
    else colorClass = 'text-danger'

    return {
      profit: estimatedProfit,
      roi,
      colorClass,
      lowestAsk
    }
  })()

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Auto-lookup product details when SKU is entered
  const handleSkuBlur = async () => {
    const sku = formData.sku?.trim()
    if (!sku) return

    setIsLoadingPreview(true)
    setProductPreview(null)
    setPreviewError(null)

    try {
      // Search both StockX and Alias in parallel
      const [stockxResponse, aliasResponse] = await Promise.all([
        fetch(`/api/stockx/search?q=${encodeURIComponent(sku)}&limit=1`).catch(() => null),
        fetch(`/api/alias/search?q=${encodeURIComponent(sku)}&limit=1`).catch(() => null),
      ])

      let stockxProduct = null
      let aliasProduct = null

      // Parse StockX response
      if (stockxResponse?.ok) {
        const stockxData = await stockxResponse.json().catch(() => null)
        if (stockxData?.results && stockxData.results.length > 0) {
          const product = stockxData.results[0]
          if (product.styleId.toLowerCase() === sku.toLowerCase()) {
            stockxProduct = product
          }
        }
      }

      // Parse Alias response
      if (aliasResponse?.ok) {
        const aliasData = await aliasResponse.json().catch(() => null)
        if (aliasData?.items && aliasData.items.length > 0) {
          const product = aliasData.items[0]
          if (product.sku?.toLowerCase() === sku.toLowerCase()) {
            aliasProduct = product
          }
        }
      }

      // Set preview using Alias image first, then StockX, with data from whichever is available
      if (stockxProduct || aliasProduct) {
        setProductPreview({
          productId: stockxProduct?.id || aliasProduct?.catalog_id || '',
          title: stockxProduct?.title || aliasProduct?.name || '',
          brand: stockxProduct?.brand || aliasProduct?.brand || '',
          colorway: stockxProduct?.colorway || aliasProduct?.colorway || '',
          image: aliasProduct?.main_picture_url || stockxProduct?.imageUrl || null,
          gender: '', // Not provided in search results
          retailPrice: stockxProduct?.medianPrice || null,
          releaseDate: null, // Not provided in search results
          category: '', // Not provided in search results
        })
      } else {
        setPreviewError(`No exact match found for SKU "${sku}"`)
      }
    } catch (error) {
      console.error('Product lookup failed:', error)
      setPreviewError('Unable to fetch product details')
    } finally {
      setIsLoadingPreview(false)
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
      if (isEditMode && editItem) {
        // Edit mode
        const payload = {
          sku: formData.sku.trim(),
          size: formData.size.trim(),
          sizeSystem: formData.sizeSystem,
          purchasePrice: parseFloat(formData.purchasePrice),
          purchaseDate: formData.purchaseDate,
          tax: formData.tax ? parseFloat(formData.tax) : undefined,
          shipping: formData.shipping ? parseFloat(formData.shipping) : undefined,
          placeOfPurchase: formData.placeOfPurchase?.trim() || undefined,
          orderNumber: formData.orderNumber?.trim() || undefined,
          condition: formData.condition,
          notes: formData.notes?.trim() || undefined,
        }

        const res = await fetch(`/api/items/${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const responseData = await res.json()

        if (!res.ok) {
          throw new Error(responseData.error || 'Failed to update item')
        }

        setToast({
          message: 'Item updated successfully!',
          variant: 'success'
        })

        console.log('Item updated:', responseData.item)

        // Give database time to propagate changes before refreshing
        await new Promise(resolve => setTimeout(resolve, 150))
        onSuccess?.()

        // Close modal after short delay
        setTimeout(() => {
          onOpenChange(false)
        }, 1500)
      } else {
        // Add mode: STABILISATION - single item only
        const payload = {
          sku: formData.sku.trim(),
          size: formData.size.trim(),
          sizeSystem: formData.sizeSystem,
          purchasePrice: parseFloat(formData.purchasePrice),
          purchaseDate: formData.purchaseDate,
          tax: formData.tax ? parseFloat(formData.tax) : undefined,
          shipping: formData.shipping ? parseFloat(formData.shipping) : undefined,
          placeOfPurchase: formData.placeOfPurchase?.trim() || undefined,
          orderNumber: formData.orderNumber?.trim() || undefined,
          condition: formData.condition,
          notes: formData.notes?.trim() || undefined,
        }

        const res = await fetch('/api/items/add-by-sku', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const responseData = await res.json()

        if (!res.ok) {
          if (responseData.code === 'NOT_FOUND') {
            throw new Error(`Product not found on StockX for SKU "${formData.sku}"`)
          } else if (responseData.code === 'NO_SIZE_MATCH') {
            throw new Error(`Size ${formData.size} ${formData.sizeSystem} not available for this product`)
          } else if (responseData.code === 'AMBIGUOUS_MATCH') {
            const matchList = responseData.matches
              .map((m: any, i: number) => `${i + 1}. ${m.title} (${m.styleId})`)
              .join('\n')
            throw new Error(
              `Multiple products found with SKU "${formData.sku}":\n\n${matchList}\n\nPlease use the full product name or contact support if you need help identifying the correct product.`
            )
          } else {
            throw new Error(responseData.error || 'Failed to add item')
          }
        }

        console.log('Item added:', responseData.item)

        // Save preferences to localStorage for smart defaults
        localStorage.setItem('add_item_size_system', formData.sizeSystem)
        if (formData.tax) localStorage.setItem('add_item_tax', formData.tax)
        if (formData.shipping) localStorage.setItem('add_item_shipping', formData.shipping)
        if (formData.placeOfPurchase) localStorage.setItem('add_item_place', formData.placeOfPurchase)

        setToast({
          message: 'Item added successfully!',
          variant: 'success'
        })

        // Give database time to propagate changes before refreshing
        await new Promise(resolve => setTimeout(resolve, 150))

        // Call onSuccess to refresh inventory list
        onSuccess?.()

        if (addAnother) {
          // Wait for refresh to complete before resetting form
          await new Promise(resolve => setTimeout(resolve, 350))

          // Reset form but keep SKU and smart defaults
          const currentSku = formData.sku
          const defaults = loadSmartDefaults()
          setFormData({
            sku: currentSku, // Keep SKU for quick multi-item entry
            sizeSystem: defaults.sizeSystem,
            purchasePrice: '',
            purchaseDate: new Date().toISOString().split('T')[0],
            tax: defaults.tax,
            shipping: defaults.shipping,
            placeOfPurchase: defaults.placeOfPurchase,
            orderNumber: '',
            condition: 'new',
            notes: '',
          })
          setSelectedSizes([]) // Clear selected sizes
          setProductPreview(null)
          setPreviewError(null)
        } else {
          // Close modal after short delay
          setTimeout(() => {
            onOpenChange(false)
          }, 1500)
        }
      }
    } catch (error: any) {
      console.error('Submit error:', error)
      setToast({
        message: error.message || `Failed to ${isEditMode ? 'update' : 'add'} item. Please try again.`,
        variant: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get size options based on selected system
  const getSizeOptions = () => {
    switch (formData.sizeSystem) {
      case 'UK':
        return SHOE_SIZES_UK
      case 'US':
        return SHOE_SIZES_US
      case 'EU':
        return SHOE_SIZES_EU
      default:
        return SHOE_SIZES_UK
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[720px] w-[90vw] rounded-2xl border border-[#15251B] bg-[#0E1A15] backdrop-blur-md shadow-large p-0 max-h-[calc(100vh-60px)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#15251B]/20">
            <DialogTitle className="text-2xl font-display font-semibold text-[#E8F6EE] tracking-tight">
              {isEditMode ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
            <p className="text-sm text-[#7FA08F] mt-1">
              {isEditMode
                ? 'Update item details below'
                : 'Enter SKU and size - all other details will be autofilled from StockX'}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(100vh-200px)] px-6 py-4">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* COLUMN 1: SKU + Size + Product Preview */}
              <div className="space-y-4">
                {/* Product Lookup Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-display text-fg uppercase tracking-wide text-xs font-semibold">
                      Product Lookup
                    </h3>
                    <div className="h-px w-12 bg-border rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* SKU */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="sku" className={labelClassName}>
                        SKU / Style ID <span className="text-accent">*</span>
                      </Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => updateField('sku', e.target.value)}
                        onBlur={handleSkuBlur}
                        placeholder="e.g., DZ5485-612, HQ6998-600"
                        className={cn(inputClassName, "font-mono", errors.sku && "border-danger")}
                      />
                      <div className="h-4 mt-1">
                        {errors.sku && (
                          <p className="text-xs text-danger">{errors.sku}</p>
                        )}
                        {isLoadingPreview && (
                          <p className="text-xs text-accent flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Looking up product...</span>
                          </p>
                        )}
                        {!isLoadingPreview && previewError && (
                          <p className="text-xs text-dim flex items-center gap-1.5">
                            <Info className="h-3 w-3" />
                            <span>{previewError}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Product Preview */}
                    {productPreview && (
                      <div className="bg-elev-1 border border-accent/20 rounded-lg p-3 space-y-3">
                        <div className="flex items-start gap-3">
                          {productPreview.image ? (
                            <img
                              src={productPreview.image}
                              alt={productPreview.title}
                              className="w-16 h-16 rounded-lg object-cover bg-elev-2"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-elev-2 flex items-center justify-center">
                              <Package className="h-6 w-6 text-dim" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-fg line-clamp-2">
                              {productPreview.title}
                            </h4>
                            <div className="text-xs text-muted space-y-0.5 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-accent">{productPreview.brand}</span>
                                {productPreview.colorway && (
                                  <>
                                    <span className="text-dim">•</span>
                                    <span>{productPreview.colorway}</span>
                                  </>
                                )}
                              </div>
                              {productPreview.marketData?.lowestAsk && (
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 dark:text-green-400 font-medium">Lowest Ask:</span>
                                  <span className="font-mono text-green-600 dark:text-green-400 font-semibold">{symbol()}{Number(productPreview.marketData.lowestAsk).toFixed(2)}</span>
                                </div>
                              )}
                              {productPreview.marketData?.highestBid && (
                                <div className="flex items-center gap-2">
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">Highest Bid:</span>
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{symbol()}{Number(productPreview.marketData.highestBid).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Size Selection Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-display text-fg uppercase tracking-wide text-xs font-semibold">
                      Size Selection
                    </h3>
                    <div className="h-px w-12 bg-border rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* Size System Tabs */}
                    <div>
                      <Label className={labelClassName}>
                        Size System <span className="text-accent">*</span>
                      </Label>
                      <div className="flex gap-2">
                        {(['UK', 'US', 'EU'] as const).map((system) => (
                          <button
                            key={system}
                            type="button"
                            onClick={() => {
                              updateField('sizeSystem', system)
                              updateField('size', '') // Reset size when system changes
                            }}
                            className={cn(
                              "flex-1 h-8 px-3 rounded-full text-sm font-medium transition-boutique",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                              formData.sizeSystem === system
                                ? "bg-accent text-fg shadow-soft"
                                : "bg-elev-1 border border-border/30 text-muted hover:bg-elev-1 hover:border-accent/30"
                            )}
                          >
                            {system}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Size Selection - STABILISATION: Single size only */}
                    <div>
                      <Label htmlFor="size" className={labelClassName}>
                        Size <span className="text-accent">*</span>
                      </Label>
                      <Select value={formData.size} onValueChange={(value) => updateField('size', value)}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent className="bg-elev-1 border-border max-h-[250px]">
                          {getSizeOptions().map((size) => (
                            <SelectItem key={size} value={size}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="h-4 mt-1">
                        {errors.size && (
                          <p className="text-xs text-danger">{errors.size}</p>
                        )}
                      </div>
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
              </div>

              {/* COLUMN 2: Purchase Info */}
              <div className="space-y-4">
                {/* Purchase Information Card */}
                <div className="bg-elev-2 rounded-2xl border border-border/20 p-4 md:p-6 space-y-4">
                  {/* Section Header */}
                  <div className="space-y-2 sticky top-0 bg-elev-2 pb-2 -mt-2">
                    <h3 className="font-display text-fg uppercase tracking-wide text-xs font-semibold">
                      Purchase Information
                    </h3>
                    <div className="h-px w-12 bg-border rounded-full" />
                  </div>

                  <div className="space-y-3">
                    {/* Purchase Price */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="purchasePrice" className={labelClassName}>
                        Purchase Price ({symbol()}) <span className="text-accent">*</span>
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

                    {/* Tax */}
                    <div className="min-h-[70px]">
                      <Label htmlFor="tax" className={labelClassName}>
                        Tax ({symbol()})
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
                        Shipping ({symbol()})
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
                    <div className="bg-soft border border-border/40 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs text-muted uppercase tracking-wide font-medium">Total</span>
                        <span className="text-base num text-fg font-semibold tabular-nums">
                          {symbol()}{purchaseTotal}
                        </span>
                      </div>
                    </div>

                    {/* Profit Indicator */}
                    {profitIndicator && (
                      <div className={cn(
                        "bg-elev-1 border rounded-lg p-3 space-y-2",
                        profitIndicator.roi >= 20 ? "border-green-500/40" :
                        profitIndicator.roi >= 10 ? "border-accent/40" :
                        profitIndicator.roi >= 0 ? "border-yellow-500/40" :
                        "border-red-500/40"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs text-muted uppercase tracking-wide font-medium">
                            Est. Profit
                          </span>
                          <span className={cn(
                            "text-base num font-semibold tabular-nums",
                            profitIndicator.roi >= 20 ? "text-green-500" :
                            profitIndicator.roi >= 10 ? "text-accent" :
                            profitIndicator.roi >= 0 ? "text-yellow-500" :
                            "text-red-500"
                          )}>
                            {profitIndicator.profit >= 0 ? '+' : ''}{symbol()}{profitIndicator.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-dim">ROI</span>
                          <span className={cn(
                            "font-mono font-medium",
                            profitIndicator.colorClass
                          )}>
                            {profitIndicator.roi >= 0 ? '+' : ''}{profitIndicator.roi.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-xs text-dim pt-1 border-t border-border/20">
                          Based on current market: {symbol()}{Number(profitIndicator.lowestAsk).toFixed(2)}
                        </div>
                      </div>
                    )}

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
                          "focus:ring-2 focus:ring-focus focus:border-accent/50",
                          "transition-boutique",
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

          {/* Footer Bar - Sticky at bottom */}
          <div className="flex justify-end gap-3 border-t border-border/20 p-5 md:p-6 bg-elev-2/70 backdrop-blur sticky bottom-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border border-border/30 hover:bg-elev-1 transition-boutique"
            >
              Cancel
            </Button>
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="border border-accent/40 text-accent hover:bg-accent/10 transition-boutique"
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
            )}
            <Button
              type="submit"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="bg-accent text-fg hover:bg-accent-600 transition-boutique"
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
