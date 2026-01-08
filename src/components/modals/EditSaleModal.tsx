/**
 * Edit Sale Modal
 * Allows editing of sale details to fix data quality issues
 */

'use client'

import { useState } from 'react'
import { X, Save, Calendar, DollarSign, Tag, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import type { SalesItem } from '@/hooks/useSalesTable'

interface EditSaleModalProps {
  sale: SalesItem
  open: boolean
  onClose: () => void
  onSave: (updates: Partial<SalesItem>) => Promise<void>
}

// Platform options - use 'alias' for new/edited sales (legacy 'goat' values still displayed correctly)
const PLATFORM_OPTIONS = [
  { value: 'stockx', label: 'StockX' },
  { value: 'alias', label: 'Alias' },
  { value: 'ebay', label: 'eBay' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok Shop' },
  { value: 'vinted', label: 'Vinted' },
  { value: 'depop', label: 'Depop' },
  { value: 'private', label: 'Private Sale' },
  { value: 'other', label: 'Other' },
]

// Normalize legacy platform values (goat → alias)
const normalizePlatform = (platform: string | null | undefined): string => {
  if (!platform) return ''
  if (platform.toLowerCase() === 'goat') return 'alias'
  return platform.toLowerCase()
}

const CURRENCY_OPTIONS = ['GBP', 'EUR', 'USD'] as const

export function EditSaleModal({ sale, open, onClose, onSave }: EditSaleModalProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    sold_price: sale.sold_price?.toString() || '',
    sale_currency: sale.sale_currency || 'GBP',
    sold_date: sale.sold_date?.split('T')[0] || '',
    platform: normalizePlatform(sale.platform),
    sales_fee: sale.sales_fee?.toString() || '',
    purchase_price: sale.purchase_price?.toString() || '',
    notes: sale.notes || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validation
    const newErrors: Record<string, string> = {}

    if (!formData.sold_price || parseFloat(formData.sold_price) <= 0) {
      newErrors.sold_price = 'Sale price is required'
    }

    if (!formData.sold_date) {
      newErrors.sold_date = 'Sale date is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      const updates: Partial<SalesItem> = {
        sold_price: parseFloat(formData.sold_price),
        sale_currency: formData.sale_currency,
        sold_date: formData.sold_date,
        platform: formData.platform || null,
        sales_fee: formData.sales_fee ? parseFloat(formData.sales_fee) : null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : sale.purchase_price,
        notes: formData.notes || null,
      }

      await onSave(updates)
      onClose()
    } catch (error) {
      console.error('[Edit Sale] Error:', error)
      setErrors({ submit: 'Failed to update sale. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg animate-in fade-in-0 zoom-in-95">
        <div className="bg-elev-1 rounded-2xl border-2 border-[#00FF94]/20 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-xl font-semibold text-fg">Edit Sale</h2>
              <p className="text-sm text-muted mt-1">
                Update sale details for {sale.brand} {sale.model}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-elev-2 rounded-lg transition-all"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Sale Price + Currency */}
            <div>
              <label className="block text-sm font-semibold text-fg mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Sale Price *
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sold_price}
                  onChange={(e) => handleChange('sold_price', e.target.value)}
                  placeholder="250.00"
                  className={cn(
                    'flex-1 text-lg font-bold mono',
                    errors.sold_price && 'border-red-500 focus:ring-red-500/30'
                  )}
                />
                <select
                  value={formData.sale_currency}
                  onChange={(e) => handleChange('sale_currency', e.target.value)}
                  className="w-20 px-2 py-2 bg-elev-0 border border-border rounded-lg text-fg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30 focus:border-[#00FF94]/30"
                >
                  {CURRENCY_OPTIONS.map((ccy) => (
                    <option key={ccy} value={ccy}>{ccy}</option>
                  ))}
                </select>
              </div>
              {errors.sold_price && (
                <p className="text-xs text-red-400 mt-1">{errors.sold_price}</p>
              )}
            </div>

            {/* Sale Date */}
            <div>
              <label className="block text-sm font-semibold text-fg mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Sale Date *
              </label>
              <Input
                type="date"
                value={formData.sold_date}
                onChange={(e) => handleChange('sold_date', e.target.value)}
                className={cn(
                  errors.sold_date && 'border-red-500 focus:ring-red-500/30'
                )}
              />
              {errors.sold_date && (
                <p className="text-xs text-red-400 mt-1">{errors.sold_date}</p>
              )}
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-semibold text-fg mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Platform
              </label>
              <select
                value={formData.platform}
                onChange={(e) => handleChange('platform', e.target.value)}
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded-lg text-fg focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30 focus:border-[#00FF94]/30"
              >
                <option value="">Select platform...</option>
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sales Fee */}
            <div>
              <label className="block text-sm font-semibold text-fg mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Sales Fee / Commission
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.sales_fee}
                onChange={(e) => handleChange('sales_fee', e.target.value)}
                placeholder="25.00"
                className="mono"
              />
              <p className="text-xs text-muted mt-1">
                Include marketplace fees, shipping costs, etc.
              </p>
            </div>

            {/* Purchase Price (if missing) */}
            {(!sale.purchase_price || sale.purchase_price === 0) && (
              <div>
                <label className="block text-sm font-semibold text-fg mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Purchase Price
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={(e) => handleChange('purchase_price', e.target.value)}
                  placeholder="200.00"
                  className="mono"
                />
                <p className="text-xs text-muted mt-1">
                  Required to calculate profit accurately
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-fg mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Add any additional notes about this sale..."
                rows={3}
                className="w-full px-3 py-2 bg-elev-0 border border-border rounded-lg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30 focus:border-[#00FF94]/30 resize-none"
              />
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#00FF94] text-black hover:bg-[#00E085]"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
