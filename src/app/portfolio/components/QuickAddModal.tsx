'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'
import { TABLE_ITEMS } from '@/lib/portfolio/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  userId?: string
}

export function QuickAddModal({ open, onOpenChange, onSuccess, userId }: QuickAddModalProps) {
  const [tab, setTab] = useState<'sku' | 'scan'>('sku')
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [size, setSize] = useState('')
  const [condition, setCondition] = useState('new')
  const [buyPrice, setBuyPrice] = useState('')
  const [source, setSource] = useState('stockx')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const handleLookup = async () => {
    if (!sku.trim()) {
      setError('Enter a SKU first')
      return
    }

    setLookupLoading(true)
    setError('')

    try {
      // Call quick lookup API
      const response = await fetch('/api/pricing/quick-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: sku.trim(), category: 'sneaker' }),
      })

      const result = await response.json()

      if (response.ok && result.catalog) {
        // Autofill from catalog
        setBrand(result.catalog.brand || '')
        setModel(result.catalog.model || '')
      } else {
        setError(result.error || 'SKU not found in catalog')
      }
    } catch (err: any) {
      setError('Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!sku || !size || !buyPrice) {
      setError('Please fill in all required fields')
      return
    }

    if (!userId) {
      setError('User not authenticated')
      return
    }

    setLoading(true)

    try {
      // Parse source to proper platform
      const platformMap: Record<string, string> = {
        stockx: 'StockX',
        ebay: 'eBay',
        vinted: 'Vinted',
        instagram: 'Instagram',
        other: 'Other',
      }

      // Insert item into Inventory table
      const { error: insertError } = await supabase.from(TABLE_ITEMS).insert({
        user_id: userId,
        sku: sku.trim(),
        brand: brand || 'Unknown',
        model: model || sku.trim(),
        size: size.trim(),
        category: 'sneaker',
        purchase_price: parseFloat(buyPrice),
        purchase_date: new Date().toISOString(),
        status: 'active',
        platform: platformMap[source] || 'Other',
        location: 'warehouse',
      })

      if (insertError) throw insertError

      // Reset form and close
      setSku('')
      setBrand('')
      setModel('')
      setSize('')
      setBuyPrice('')
      setCondition('new')
      setSource('stockx')

      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      console.error('Failed to add item:', err)
      setError(err.message || 'Failed to add item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>
            Enter SKU to autofill model & colorway
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-bg border border-border rounded-lg">
            <button
              type="button"
              onClick={() => setTab('sku')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-boutique ${
                tab === 'sku' ? 'bg-surface2 text-fg font-medium' : 'text-muted hover:text-fg'
              }`}
            >
              SKU
            </button>
            <button
              type="button"
              onClick={() => setTab('scan')}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-boutique ${
                tab === 'scan' ? 'bg-surface2 text-fg font-medium' : 'text-muted hover:text-fg'
              }`}
            >
              Scan
            </button>
          </div>

          {tab === 'sku' ? (
            <>
              {/* SKU Input */}
              <div>
                <label htmlFor="sku" className="block text-xs font-medium text-muted mb-1">
                  SKU *
                </label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g., DZ5485-612"
                    className="flex-1 num"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLookup}
                    disabled={lookupLoading || !sku.trim()}
                  >
                    {lookupLoading ? 'Looking up...' : 'Lookup'}
                  </Button>
                </div>
              </div>

              {/* Autofilled Fields */}
              {(brand || model) && (
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-xs text-muted mb-1">Product Info</p>
                  <p className="text-sm text-fg font-medium">
                    {brand} {model}
                  </p>
                </div>
              )}

              {/* Core Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="size" className="block text-xs font-medium text-muted mb-1">
                    Size (UK) *
                  </label>
                  <Input
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="10"
                    className="num"
                  />
                </div>
                <div>
                  <label htmlFor="condition" className="block text-xs font-medium text-muted mb-1">
                    Condition *
                  </label>
                  <select
                    id="condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="buyPrice" className="block text-xs font-medium text-muted mb-1">
                  Buy Price (£) *
                </label>
                <Input
                  id="buyPrice"
                  type="number"
                  step="0.01"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="120.00"
                  className="num text-right"
                />
              </div>

              <div>
                <label htmlFor="source" className="block text-xs font-medium text-muted mb-1">
                  Source *
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <option value="stockx">StockX</option>
                  <option value="ebay">eBay</option>
                  <option value="vinted">Vinted</option>
                  <option value="instagram">Instagram</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}
            </>
          ) : (
            <div className="aspect-video rounded-xl border border-border bg-bg grid place-items-center text-dim">
              <p className="text-sm">Camera scanning not implemented</p>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !sku || !size || !buyPrice}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
