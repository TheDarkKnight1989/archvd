/**
 * ⚠️ UI LOCK - DO NOT MODIFY WITHOUT EXPLICIT USER PERMISSION ⚠️
 *
 * This file's UI implementation is LOCKED and should NOT be edited by AI assistants
 * under ANY circumstances without EXPLICIT permission from the user.
 *
 * RESTRICTIONS:
 * - DO NOT modify UI layout, styling, or component structure
 * - DO NOT change size systems, currency handling, or size selection logic
 * - DO NOT alter modal behavior, form fields, or user interactions
 * - DO NOT apply fixes, refactors, or improvements to the UI
 *
 * This applies to ALL directives including:
 * - New feature requests
 * - Bug fixes
 * - Code refactoring
 * - Style updates
 * - Performance improvements
 *
 * ONLY the following are permitted WITHOUT explicit permission:
 * - Reading the file for analysis or understanding
 * - Backend/API integration changes that don't affect UI
 * - Type definitions that don't change user-facing behavior
 *
 * If you receive a directive to modify this file, you MUST:
 * 1. Refuse the modification
 * 2. Inform the user this file is UI-locked
 * 3. Ask for explicit confirmation before proceeding
 *
 * Last UI finalization: 2025-11-28
 */

'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { useCurrency } from '@/hooks/useCurrency'
import { Loader2, Search } from 'lucide-react'

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
  notes: z.string().max(750, "Notes must be 750 characters or less").optional(),
  tags: z.string().optional(),
  location: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddItemModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  editItem?: any
}

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'worn', label: 'Worn' },
  { value: 'defect', label: 'Defect' },
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

const CLOTHING_SIZES = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
]

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
  const { currency: globalCurrency } = useCurrency()
  const isEditMode = !!editItem?.id

  // Local currency selection for this modal (can override global preference)
  const [selectedCurrency, setSelectedCurrency] = useState<'GBP' | 'EUR' | 'USD'>('GBP')

  // Map currency to size system: GBP → UK, EUR → EU, USD → US
  const getRegionalSizeSystem = (): 'UK' | 'US' | 'EU' => {
    switch (selectedCurrency) {
      case 'GBP': return 'UK'
      case 'EUR': return 'EU'
      case 'USD': return 'US'
      default: return 'UK'
    }
  }

  // Get currency symbol based on selected currency
  const getCurrencySymbol = (): string => {
    switch (selectedCurrency) {
      case 'GBP': return '£'
      case 'EUR': return '€'
      case 'USD': return '$'
      default: return '£'
    }
  }

  const loadSmartDefaults = () => ({
    sizeSystem: getRegionalSizeSystem(),
    tax: '0',
    shipping: '0',
    placeOfPurchase: '',
  })

  const [formData, setFormData] = useState<FormData>({
    sku: '',
    size: '',
    sizeSystem: 'UK', // Will be set correctly when modal opens
    purchasePrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    tax: '0',
    shipping: '0',
    placeOfPurchase: '',
    orderNumber: '',
    condition: 'new',
    notes: '',
    tags: '',
    location: '',
  })

  const [selectedSizes, setSelectedSizes] = useState<Array<{ size: string; quantity: number }>>([])
  const [nameSearch, setNameSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'default' | 'success' | 'error' } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [productPreview, setProductPreview] = useState<ProductPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [sizeCategory, setSizeCategory] = useState<'shoes' | 'apparel' | 'other'>('shoes')
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [customSize, setCustomSize] = useState('')

  // Initialize currency from user's global preference when modal opens
  useEffect(() => {
    if (open && globalCurrency) {
      setSelectedCurrency(globalCurrency as 'GBP' | 'EUR' | 'USD')
    }
  }, [open, globalCurrency])

  // Auto-update size system when currency changes (GBP→UK, EUR→EU, USD→US)
  useEffect(() => {
    if (!isEditMode && open) {
      const regionalSizeSystem = getRegionalSizeSystem()
      setFormData(prev => ({
        ...prev,
        sizeSystem: regionalSizeSystem,
      }))
    }
  }, [selectedCurrency, open, isEditMode])

  useEffect(() => {
    if (open) {
      if (editItem) {
        setFormData({
          sku: editItem.sku || '',
          size: editItem.size_uk?.toString() || '',
          sizeSystem: 'UK',
          purchasePrice: editItem.avgCost?.toString() || '',
          purchaseDate: editItem.purchaseDate || new Date().toISOString().split('T')[0],
          tax: '0',
          shipping: '0',
          placeOfPurchase: editItem.placeOfPurchase || '',
          orderNumber: editItem.orderNumber || '',
          condition: (editItem.condition as any) || 'new',
          notes: editItem.notes || '',
          tags: '',
          location: editItem.location || '',
        })
        // Populate selected sizes for edit mode
        if (editItem.size_uk) {
          setSelectedSizes([{ size: editItem.size_uk.toString(), quantity: 1 }])
        }
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
        const defaults = loadSmartDefaults()
        setFormData({
          sku: '',
          size: '',
          sizeSystem: defaults.sizeSystem,
          purchasePrice: '',
          purchaseDate: new Date().toISOString().split('T')[0],
          tax: '0',
          shipping: '0',
          placeOfPurchase: defaults.placeOfPurchase,
          orderNumber: '',
          condition: 'new',
          notes: '',
          tags: '',
          location: '',
        })
        setProductPreview(null)
      }
      setPreviewError(null)
      setErrors({})
      setSelectedSizes([])
      setNameSearch('')
    } else {
      // Clean up when modal closes - reset everything to defaults
      const defaults = loadSmartDefaults()
      setFormData({
        sku: '',
        size: '',
        sizeSystem: defaults.sizeSystem,
        purchasePrice: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        tax: '0',
        shipping: '0',
        placeOfPurchase: defaults.placeOfPurchase,
        orderNumber: '',
        condition: 'new',
        notes: '',
        tags: '',
        location: '',
      })
      setProductPreview(null)
      setPreviewError(null)
      setErrors({})
      setSelectedSizes([])
      setNameSearch('')
      setShowSearchResults(false)
      setSearchResults([])
      setShowCustomSize(false)
      setCustomSize('')
      setSizeCategory('shoes')
    }
  }, [open, isEditMode, editItem])

  // Search products by name using Alias API
  useEffect(() => {
    const searchProducts = async () => {
      if (!nameSearch || nameSearch.length < 3) {
        setSearchResults([])
        setShowSearchResults(false)
        return
      }

      setIsSearching(true)
      setShowSearchResults(true)

      try {
        // Use only Alias API - it already has images and all product details
        const response = await fetch(`/api/alias/search?query=${encodeURIComponent(nameSearch)}&limit=10`)

        if (!response.ok) {
          console.error('[AddItemModal] Alias search failed:', response.statusText)
          setSearchResults([])
          return
        }

        const data = await response.json()
        console.log('[AddItemModal] Alias search results:', data)

        if (data?.items && Array.isArray(data.items)) {
          // Map Alias catalog items to search result format
          const results = data.items.map((item: any) => ({
            id: item.catalog_id,
            catalog_id: item.catalog_id,
            source: 'alias',
            sku: item.sku,
            name: item.name,
            brand: item.brand,
            colorway: item.colorway,
            image: item.main_picture_url, // Alias provides images
            releaseDate: item.release_date, // YYYY-MM-DD format
            retailPrice: item.retail_price_cents ? (item.retail_price_cents / 100).toFixed(2) : null, // Convert cents to dollars
            category: item.product_category_v2 || 'shoes', // 'shoes', 'apparel', 'accessories', 'collectibles'
          }))

          console.log('[AddItemModal] Formatted search results:', results)
          setSearchResults(results)
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('[AddItemModal] Search failed:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const debounce = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounce)
  }, [nameSearch])

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

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSkuBlur = async () => {
    const sku = formData.sku?.trim()
    if (!sku) return

    setIsLoadingPreview(true)
    setProductPreview(null)
    setPreviewError(null)

    try {
      const [stockxResponse, aliasResponse] = await Promise.all([
        fetch(`/api/stockx/search?q=${encodeURIComponent(sku)}&limit=1`).catch(() => null),
        fetch(`/api/alias/search?q=${encodeURIComponent(sku)}&limit=1`).catch(() => null),
      ])

      let stockxProduct = null
      let aliasProduct = null

      if (stockxResponse?.ok) {
        const stockxData = await stockxResponse.json().catch(() => null)
        if (stockxData?.results && stockxData.results.length > 0) {
          const product = stockxData.results[0]
          if (product.styleId.toLowerCase() === sku.toLowerCase()) {
            stockxProduct = product
          }
        }
      }

      if (aliasResponse?.ok) {
        const aliasData = await aliasResponse.json().catch(() => null)
        if (aliasData?.items && aliasData.items.length > 0) {
          const product = aliasData.items[0]
          if (product.sku?.toLowerCase() === sku.toLowerCase()) {
            aliasProduct = product
          }
        }
      }

      if (stockxProduct || aliasProduct) {
        setProductPreview({
          productId: stockxProduct?.id || aliasProduct?.catalog_id || '',
          title: stockxProduct?.title || aliasProduct?.name || '',
          brand: stockxProduct?.brand || aliasProduct?.brand || '',
          colorway: stockxProduct?.colorway || aliasProduct?.colorway || '',
          image: aliasProduct?.main_picture_url || stockxProduct?.imageUrl || null,
          gender: '',
          retailPrice: stockxProduct?.medianPrice || null,
          releaseDate: null,
          category: '',
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
          location: formData.location?.trim() || undefined,
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

        await new Promise(resolve => setTimeout(resolve, 150))
        onSuccess?.()

        setTimeout(() => {
          onOpenChange(false)
        }, 1500)
      } else {
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
          location: formData.location?.trim() || undefined,
          currency: selectedCurrency, // User's selected currency (determines region for StockX/Alias)
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

        localStorage.setItem('add_item_size_system', formData.sizeSystem)

        setToast({
          message: 'Item added successfully!',
          variant: 'success'
        })

        await new Promise(resolve => setTimeout(resolve, 150))
        onSuccess?.()

        if (addAnother) {
          await new Promise(resolve => setTimeout(resolve, 350))
          const currentSku = formData.sku
          const defaults = loadSmartDefaults()
          setFormData({
            sku: currentSku,
            size: '',
            sizeSystem: defaults.sizeSystem,
            purchasePrice: '',
            purchaseDate: new Date().toISOString().split('T')[0],
            tax: '0',
            shipping: '0',
            placeOfPurchase: defaults.placeOfPurchase,
            orderNumber: '',
            condition: 'new',
            notes: '',
            tags: '',
            location: '',
          })
          setProductPreview(null)
          setPreviewError(null)
          setSelectedSizes([])
        } else {
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

  const getSizeOptions = () => {
    // Return clothing sizes if apparel category is selected
    if (sizeCategory === 'apparel') {
      return CLOTHING_SIZES
    }

    // For "other" category, return empty array (will show text input instead)
    if (sizeCategory === 'other') {
      return []
    }

    // Return shoe sizes based on size system
    switch (formData.sizeSystem) {
      case 'UK': return SHOE_SIZES_UK
      case 'US': return SHOE_SIZES_US
      case 'EU': return SHOE_SIZES_EU
      default: return SHOE_SIZES_UK
    }
  }

  const handleSizeSelect = (size: string) => {
    // Check if size already selected
    if (selectedSizes.some(s => s.size === size)) {
      return
    }
    // Add size with default quantity of 1
    setSelectedSizes(prev => [...prev, { size, quantity: 1 }])
    // Also update formData.size for validation purposes (use first size)
    if (selectedSizes.length === 0) {
      updateField('size', size)
    }
  }

  const handleAddCustomSize = () => {
    if (customSize.trim()) {
      handleSizeSelect(customSize.trim())
      setShowCustomSize(false)
      setCustomSize('')
    }
  }

  const handleQuantityChange = (size: string, quantity: number) => {
    setSelectedSizes(prev =>
      prev.map(s => s.size === size ? { ...s, quantity: Math.max(1, quantity) } : s)
    )
  }

  const handleRemoveSize = (size: string) => {
    setSelectedSizes(prev => {
      const newSizes = prev.filter(s => s.size !== size)
      // Update formData.size for validation
      if (newSizes.length > 0) {
        updateField('size', newSizes[0].size)
      } else {
        updateField('size', '')
      }
      return newSizes
    })
  }

  // Clean product name by removing specific size numbers only
  const cleanProductName = (name: string): string => {
    if (!name) return name
    // Only remove patterns like "(Size 8.5)" - keep GS, PS, TD, Infant, etc.
    return name
      .replace(/\s*\(Size\s+[\d.]+\)\s*/gi, '')
      .trim()
  }

  const handleSelectProduct = (product: any) => {
    // Set SKU
    updateField('sku', product.sku)

    // Auto-fill purchase price from retail price if available
    if (product.retailPrice) {
      updateField('purchasePrice', product.retailPrice)
    }

    // Auto-detect and set size category based on product category
    const productCategory = (product.category || '').toLowerCase()
    console.log('[AddItemModal] Selected product category:', productCategory, 'Full product:', product)

    if (productCategory === 'shoes' || productCategory === 'sneakers') {
      setSizeCategory('shoes')
    } else if (productCategory === 'apparel' || productCategory === 'clothing' || productCategory === 'streetwear') {
      setSizeCategory('apparel')
    } else {
      setSizeCategory('other')
    }

    // Set product preview
    setProductPreview({
      productId: product.id || product.catalog_id || '',
      title: cleanProductName(product.name || product.title),
      brand: product.brand || '',
      colorway: product.colorway || '',
      image: product.image || product.main_picture_url || null,
      gender: product.gender || '',
      retailPrice: product.retailPrice || null,
      releaseDate: product.releaseDate || null,
      category: product.category || '',
    })

    // Clear search
    setNameSearch('')
    setShowSearchResults(false)
    setSearchResults([])
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-none sm:max-w-[900px] sm:w-[95vw] max-h-[calc(100vh-80px)] sm:max-h-[95vh] rounded-t-2xl sm:rounded-2xl border-0 bg-[#111111]/95 backdrop-blur-md p-0 overflow-y-auto shadow-2xl">
          {/* Header with product info */}
          <div className="border-b border-[#2a2a2a] px-4 sm:px-8 py-4 sm:py-6">
            <div className="space-y-4">
              {/* Name and Style ID Row */}
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Name *
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 z-10" />
                    <Input
                      value={nameSearch || productPreview?.title || ''}
                      onChange={(e) => {
                        const newValue = e.target.value
                        setNameSearch(newValue)
                        // If user starts typing and there's already a product selected, clear it
                        if (newValue && productPreview) {
                          setProductPreview(null)
                          updateField('sku', '')
                        }
                      }}
                      onFocus={() => {
                        // If there's a product selected, populate nameSearch so user can edit
                        if (productPreview?.title && !nameSearch) {
                          setNameSearch(productPreview.title)
                        }
                        if (searchResults.length > 0) setShowSearchResults(true)
                      }}
                      placeholder="Search by product name"
                      className={cn(
                        "pl-11 h-12 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 rounded-xl text-base",
                        "focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]",
                        "transition-all duration-200"
                      )}
                    />

                    {/* Search Results Dropdown */}
                    {showSearchResults && (nameSearch.length >= 3) && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-50">
                        {isSearching ? (
                          <div className="p-4 flex items-center justify-center text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-4 text-center text-gray-400">No products found</div>
                        ) : (
                          searchResults.map((product, index) => (
                            <button
                              key={`${product.source}-${product.sku || product.id}-${index}`}
                              onClick={() => handleSelectProduct(product)}
                              className="w-full p-3 flex items-start gap-3 hover:bg-[#222222] transition-colors border-b border-[#2a2a2a] last:border-b-0 text-left"
                            >
                              {/* Thumbnail - show if available */}
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-16 h-16 object-cover rounded-lg bg-[#111111] flex-shrink-0"
                                  onError={(e) => {
                                    // Hide broken images
                                    e.currentTarget.style.display = 'none'
                                    const parent = e.currentTarget.parentElement
                                    if (parent) {
                                      const placeholder = document.createElement('div')
                                      placeholder.className = 'w-16 h-16 bg-[#111111] rounded-lg flex items-center justify-center flex-shrink-0'
                                      placeholder.innerHTML = '<span class="text-gray-600 text-xs">No image</span>'
                                      parent.appendChild(placeholder)
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-[#111111] rounded-lg flex items-center justify-center flex-shrink-0">
                                  <span className="text-gray-600 text-xs">No image</span>
                                </div>
                              )}

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                {/* SKU - small and subtle at top */}
                                <div className="text-gray-500 text-xs mb-1 truncate">
                                  {product.sku}
                                </div>
                                <div className="font-semibold text-white text-sm mb-1 truncate">
                                  {product.brand || 'Unknown Brand'}
                                </div>
                                <div className="text-white text-sm mb-1 truncate">
                                  {cleanProductName(product.name || product.title)}
                                </div>
                                {product.colorway && (
                                  <div className="text-gray-400 text-xs mb-1 truncate">
                                    {product.colorway}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {product.releaseDate && (
                                    <span>{new Date(product.releaseDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                                  )}
                                  {product.retailPrice && (
                                    <>
                                      {product.releaseDate && <span>-</span>}
                                      <span>${product.retailPrice}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Style ID
                  </Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => updateField('sku', e.target.value)}
                    onBlur={handleSkuBlur}
                    placeholder="Enter SKU"
                    className={cn(
                      "h-12 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-gray-500 rounded-xl text-base",
                      "focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]",
                      "transition-all duration-200",
                      errors.sku && "border-red-500/50 focus-visible:ring-red-500/50"
                    )}
                  />
                </div>
              </div>

              {/* Loading/Error States */}
              {isLoadingPreview && (
                <p className="text-xs text-[#00FF87] flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up product...
                </p>
              )}
              {previewError && !isLoadingPreview && (
                <p className="text-xs text-gray-500">{previewError}</p>
              )}

              {/* Brand, Color, and Condition Row */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Brand
                  </Label>
                  <Input
                    value={productPreview?.brand || ''}
                    readOnly
                    placeholder="Nike"
                    className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl cursor-default"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Color
                  </Label>
                  <Input
                    value={productPreview?.colorway || ''}
                    readOnly
                    placeholder="White"
                    className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl cursor-default"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Condition
                  </Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value) => updateField('condition', value as any)}
                  >
                    <SelectTrigger className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      {CONDITION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 px-4 sm:px-8 py-4 sm:py-6 max-h-[calc(100vh-300px)] sm:max-h-[calc(95vh-240px)] overflow-y-auto">
            {/* Left Column - Purchase Info */}
            <div className="space-y-5">
              {/* Purchase Price */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Purchase Price *
                </Label>
                <div className="flex items-center gap-2">
                  {/* Compact Currency Selector - shows only symbol when closed */}
                  <Select
                    value={selectedCurrency}
                    onValueChange={(value) => {
                      const newCurrency = value as 'GBP' | 'EUR' | 'USD'
                      setSelectedCurrency(newCurrency)
                      // Update size system based on new currency
                      const newSizeSystem = newCurrency === 'GBP' ? 'UK' : newCurrency === 'EUR' ? 'EU' : 'US'
                      updateField('sizeSystem', newSizeSystem)
                    }}
                  >
                    <SelectTrigger className="w-[60px] h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] font-medium text-base">
                      <SelectValue>
                        {getCurrencySymbol()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      <SelectItem value="GBP" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">
                        £ GBP - UK Sizes
                      </SelectItem>
                      <SelectItem value="EUR" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">
                        € EUR - EU Sizes
                      </SelectItem>
                      <SelectItem value="USD" className="text-white hover:bg-[#222222] focus:bg-[#222222] cursor-pointer">
                        $ USD - US Sizes
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => updateField('purchasePrice', e.target.value)}
                    placeholder="275"
                    className={cn(
                      "flex-1 h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl",
                      "focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]",
                      "transition-all duration-200",
                      errors.purchasePrice && "border-red-500/50"
                    )}
                  />
                </div>
                {errors.purchasePrice && (
                  <p className="text-xs text-red-400 mt-1.5">{errors.purchasePrice}</p>
                )}
              </div>

              {/* Tax */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Tax
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax}
                  onChange={(e) => updateField('tax', e.target.value)}
                  placeholder="0.00"
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>

              {/* Shipping */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Shipping
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shipping}
                  onChange={(e) => updateField('shipping', e.target.value)}
                  placeholder="0.00"
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>

              {/* Place of Purchase */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Place of purchase
                </Label>
                <Input
                  value={formData.placeOfPurchase}
                  onChange={(e) => updateField('placeOfPurchase', e.target.value)}
                  placeholder="SNKRS, Adidas, End, KITH etc"
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>

              {/* Purchase Date & Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Purchase Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => updateField('purchaseDate', e.target.value)}
                    className={cn(
                      "h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl",
                      "focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]",
                      "transition-all duration-200",
                      errors.purchaseDate && "border-red-500/50"
                    )}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Tags
                  </Label>
                  <Input
                    value={formData.tags}
                    onChange={(e) => updateField('tags', e.target.value)}
                    placeholder="Enter some tags"
                    className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                  />
                </div>
              </div>

              {/* Selected Sizes */}
              {selectedSizes.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Selected Sizes
                  </Label>
                  <div className="space-y-2">
                    {selectedSizes.map(({ size, quantity }) => (
                      <div key={size} className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
                        <div className="flex-1">
                          <span className="text-white font-semibold">Size {size}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={quantity}
                            onChange={(e) => handleQuantityChange(size, parseInt(e.target.value) || 1)}
                            className="w-20 h-9 bg-[#111111] border-[#2a2a2a] text-white text-center rounded-lg focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]"
                          />
                          <button
                            onClick={() => handleRemoveSize(size)}
                            className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Number */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Order number
                </Label>
                <Input
                  value={formData.orderNumber}
                  onChange={(e) => updateField('orderNumber', e.target.value)}
                  placeholder="#00000"
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>

              {/* Notes */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Notes
                  </Label>
                  <span className="text-xs text-gray-600">
                    {formData.notes?.length || 0}/750 characters left
                  </span>
                </div>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  maxLength={750}
                  rows={4}
                  placeholder="Add any notes about this item..."
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl resize-none focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>
            </div>

            {/* Right Column - Size Grid */}
            <div className="space-y-5">
              {/* Category Tabs */}
              <div className="border-b border-[#2a2a2a]">
                <div className="flex gap-8">
                  {(['shoes', 'apparel', 'other'] as const).map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSizeCategory(category)
                        // Clear selected sizes when changing category
                        setSelectedSizes([])
                        updateField('size', '')
                      }}
                      className={cn(
                        "pb-3 text-sm font-semibold capitalize border-b-2 transition-all duration-200",
                        sizeCategory === category
                          ? "border-[#00FF87] text-white"
                          : "border-transparent text-gray-400 hover:text-gray-300"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Grid or Text Input */}
              {sizeCategory === 'other' ? (
                // For "other" category, show a simple text input
                <div>
                  <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Size *
                  </Label>
                  <Input
                    value={formData.size}
                    onChange={(e) => updateField('size', e.target.value)}
                    placeholder="Enter size (e.g., One Size, OS, 250ml)"
                    className={cn(
                      "h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl",
                      "focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87]",
                      "transition-all duration-200",
                      errors.size && "border-red-500/50"
                    )}
                  />
                </div>
              ) : (
                // For shoes and apparel, show size grid
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {getSizeOptions().map((size) => {
                      const isSelected = selectedSizes.some(s => s.size === size)
                      return (
                        <button
                          key={size}
                          onClick={() => handleSizeSelect(size)}
                          disabled={isSelected}
                          className={cn(
                            "h-11 rounded-xl text-sm font-semibold transition-all duration-200",
                            isSelected
                              ? "bg-[#00FF87] text-black shadow-lg cursor-default"
                              : "bg-[#1a1a1a] text-gray-300 hover:bg-[#222222] hover:text-white hover:scale-[1.02]"
                          )}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>

                  {/* Add Other Size - only for shoes and apparel */}
                  {showCustomSize ? (
                    <div className="flex gap-2 pt-2">
                      <Input
                        value={customSize}
                        onChange={(e) => setCustomSize(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCustomSize()
                          if (e.key === 'Escape') {
                            setShowCustomSize(false)
                            setCustomSize('')
                          }
                        }}
                        placeholder="Enter size"
                        className="flex-1 h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87]"
                        autoFocus
                      />
                      <Button
                        onClick={handleAddCustomSize}
                        disabled={!customSize.trim()}
                        className="bg-[#00FF87] hover:bg-[#00e67a] text-black font-semibold px-6 rounded-xl h-11"
                      >
                        Add
                      </Button>
                      <Button
                        onClick={() => {
                          setShowCustomSize(false)
                          setCustomSize('')
                        }}
                        variant="ghost"
                        className="text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl h-11"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCustomSize(true)}
                      className="text-sm text-[#00FF87] hover:text-[#00e67a] font-semibold transition-colors pt-2"
                    >
                      + Add other size
                    </button>
                  )}
                </>
              )}

              {errors.size && (
                <p className="text-xs text-red-400 pt-1">{errors.size}</p>
              )}

              {/* Location */}
              <div>
                <Label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                  Location
                </Label>
                <Input
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Shelf A, Closet 1, etc."
                  className="h-11 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-xl focus-visible:ring-2 focus-visible:ring-[#00FF87] focus-visible:border-[#00FF87] transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#2a2a2a] px-4 sm:px-8 py-4 sm:py-5 pb-6 sm:pb-5 flex justify-end gap-3 bg-[#0f0f0f]">
            <Button
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              variant="ghost"
              className="text-gray-400 hover:text-white hover:bg-[#1a1a1a] font-semibold px-6 h-11 rounded-xl"
            >
              Close
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="bg-[#00FF87] hover:bg-[#00e67a] text-black font-bold px-8 h-11 rounded-xl shadow-lg hover:shadow-[#00FF87]/20 transition-all duration-200"
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
